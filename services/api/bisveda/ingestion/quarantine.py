from datetime import datetime, timezone
import hashlib
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from bisveda.config.settings import get_settings
from bisveda.contracts.evidence import EvidenceClass


class QuarantineRecord(BaseModel):
    media_id: str
    filename: str
    file_path: str
    file_size_bytes: int
    quarantined_at: str
    evidence_class: str = EvidenceClass.USER_PROVIDED.value
    prompt_injection_detected: bool = False
    injection_flags: List[str] = Field(default_factory=list)
    cited_standards: List[str] = Field(default_factory=list)
    audit_verdict: str = "ISOLATED_CLEAN"  # ISOLATED_CLEAN, ISOLATED_SUSPICIOUS_INJECTION
    extracted_text_preview: str = ""
    is_citable: bool = False  # Rule 9: Strictly non-citable as BIS authority


class QuarantineSandbox:
    """
    Quarantine Sandbox (Rule 9 & D43).
    Isolates user-uploaded tenders, drawings, and third-party documents from the shared index.
    Tags all extracted text as EvidenceClass.USER_PROVIDED and runs security & prompt-injection audits.
    """

    def __init__(self, quarantine_dir: Optional[Path] = None):
        settings = get_settings()
        self.quarantine_dir = quarantine_dir or (settings.storage_root / "uploads" / "quarantine")
        self.quarantine_dir.mkdir(parents=True, exist_ok=True)
        self._registry: Dict[str, QuarantineRecord] = {}

        # Known prompt injection & regulatory override patterns
        self.injection_patterns = [
            (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions", re.IGNORECASE), "DIRECTIVE_OVERRIDE"),
            (re.compile(r"disregard\s+(?:all\s+)?(?:above|previous|system)\s+(?:rules|instructions)", re.IGNORECASE), "RULE_DISREGARD"),
            (re.compile(r"system\s*prompt", re.IGNORECASE), "SYSTEM_PROMPT_PROBE"),
            (re.compile(r"you\s+are\s+now\s+(?:in\s+DAN\s+mode|unrestricted|god\s+mode)", re.IGNORECASE), "JAILBREAK_ATTEMPT"),
            (re.compile(r"developer\s+mode\s+enabled", re.IGNORECASE), "DEVELOPER_MODE_PROBE"),
            (re.compile(r"override\s+(?:bis|qco|statutory)\s+(?:mandate|order|law)", re.IGNORECASE), "REGULATORY_OVERRIDE_ATTEMPT"),
            (re.compile(r"mark\s+(?:this\s+product\s+as\s+exempt|as\s+certified\s+without\s+audit)", re.IGNORECASE), "FRAUDULENT_CERTIFICATION_CLAIM"),
            (re.compile(r"<script[\s\S]*?>[\s\S]*?<\/script>", re.IGNORECASE), "HTML_SCRIPT_INJECTION"),
            (re.compile(r"(?:eval\(|exec\(|os\.system\()", re.IGNORECASE), "CODE_EXECUTION_ATTEMPT"),
        ]

        self.is_regex = re.compile(r"\b(IS\s*[:\-]?\s*\d+(?:\s*(?:Part\s*\d+|Pt\s*\d+))?(?:\s*:\s*\d{4})?)\b", re.IGNORECASE)

    def isolate_upload(
        self,
        file_bytes: bytes,
        filename: str,
        extracted_text: str = "",
    ) -> QuarantineRecord:
        media_id = f"Q-{hashlib.sha256(file_bytes).hexdigest()[:12].upper()}"
        file_name_clean = re.sub(r"[^\w\.\-]", "_", filename)
        saved_file_name = f"{media_id}_{file_name_clean}"
        target_path = self.quarantine_dir / saved_file_name

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        # Scan extracted text for prompt injections
        is_injected, flags, verdict = self.scan_for_injection(extracted_text)

        # Extract cited IS standards
        cited_standards = []
        for m in self.is_regex.finditer(extracted_text):
            std = re.sub(r"\s+", " ", m.group(1)).upper()
            if std not in cited_standards:
                cited_standards.append(std)

        record = QuarantineRecord(
            media_id=media_id,
            filename=filename,
            file_path=str(target_path),
            file_size_bytes=len(file_bytes),
            quarantined_at=datetime.now(timezone.utc).isoformat(),
            evidence_class=EvidenceClass.USER_PROVIDED.value,
            prompt_injection_detected=is_injected,
            injection_flags=flags,
            cited_standards=cited_standards,
            audit_verdict=verdict,
            extracted_text_preview=extracted_text[:400] if extracted_text else "",
            is_citable=False,
        )

        self._registry[media_id] = record
        return record

    def scan_for_injection(self, text: str) -> Tuple[bool, List[str], str]:
        if not text:
            return False, [], "ISOLATED_CLEAN"

        flags = []
        for pat, tag in self.injection_patterns:
            if pat.search(text):
                flags.append(tag)

        if flags:
            return True, flags, "ISOLATED_SUSPICIOUS_INJECTION"
        return False, [], "ISOLATED_CLEAN"

    def get_record(self, media_id: str) -> Optional[QuarantineRecord]:
        return self._registry.get(media_id)

    def list_records(self) -> List[QuarantineRecord]:
        return list(self._registry.values())
