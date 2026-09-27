from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field

from bisveda.config.settings import get_settings


class CitationFinding(BaseModel):
    cited_raw: str
    standard_number: str
    cited_year: Optional[str] = None
    current_standard: str
    current_year: Optional[str] = None
    current_title: Optional[str] = None
    status: str  # current, older_edition, superseded, withdrawn, unknown
    context_snippet: Optional[str] = None
    action_required: str


class OutdatedReferenceReport(BaseModel):
    report_id: str
    doc_name: str
    total_citations: int
    outdated_count: int
    findings: List[CitationFinding] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class OutdatedReferenceChecker:
    """
    V8 Canonical Spec §11.4: Outdated-Reference Checker.
    Scans ingested documents, tenders, and specifications for cited Indian Standards
    and detects references to older editions, superseded standards, and withdrawn standards.
    """

    CITATION_PATTERN = re.compile(
        r"\b(?:IS|is|Is)\s*[-:]?\s*(\d+)(?:\s*(?:Part\s*(\d+)|Pt\.?\s*(\d+)))?(?:\s*[:\-–]\s*(\d{4}))?\b"
    )

    def __init__(self, standards_file: Optional[Path] = None):
        settings = get_settings()
        self.standards_file = standards_file or (settings.data_dir / "seed" / "standards.json")
        self.catalog: Dict[str, Dict[str, Any]] = {}
        self._load_catalog()

    def _load_catalog(self):
        if self.standards_file and self.standards_file.exists():
            with open(self.standards_file, "r", encoding="utf-8") as f:
                standards_list = json.load(f)
            for std in standards_list:
                std_num = std.get("standard_number", "").strip().upper()
                if std_num:
                    self.catalog[std_num] = std
                    # Also register without space, e.g. "IS14543"
                    norm = std_num.replace(" ", "")
                    self.catalog[norm] = std

    def scan_text(self, text: str, doc_name: str = "document.pdf") -> OutdatedReferenceReport:
        findings: List[CitationFinding] = []
        seen = set()

        for match in self.CITATION_PATTERN.finditer(text):
            raw = match.group(0).strip()
            num = match.group(1)
            part = match.group(2) or match.group(3)
            cited_year = match.group(4)

            canonical_is = f"IS {num}"
            if part:
                canonical_is += f" (Part {part})"

            dedup_key = f"{canonical_is}:{cited_year or ''}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            # Extract sentence context snippet
            start = max(0, match.start() - 60)
            end = min(len(text), match.end() + 60)
            snippet = text[start:end].replace("\n", " ").strip()

            std_record = self.catalog.get(canonical_is) or self.catalog.get(canonical_is.replace(" ", ""))

            if not std_record:
                findings.append(
                    CitationFinding(
                        cited_raw=raw,
                        standard_number=canonical_is,
                        cited_year=cited_year,
                        current_standard=canonical_is,
                        current_year=None,
                        current_title="Uncatalogued / Supplementary Standard",
                        status="unknown",
                        context_snippet=snippet,
                        action_required=f"Verify validity on BIS services portal (standards.bis.gov.in) for {canonical_is}.",
                    )
                )
                continue

            current_year = str(std_record.get("year") or "").strip()
            current_title = std_record.get("full_title") or std_record.get("short_title") or canonical_is
            superseded_by = std_record.get("superseded_by")
            status_raw = str(std_record.get("status") or "").lower()

            if superseded_by:
                findings.append(
                    CitationFinding(
                        cited_raw=raw,
                        standard_number=canonical_is,
                        cited_year=cited_year,
                        current_standard=superseded_by,
                        current_year=current_year or None,
                        current_title=current_title,
                        status="superseded",
                        context_snippet=snippet,
                        action_required=f"Replace obsolete standard {canonical_is} with superseding standard {superseded_by}.",
                    )
                )
            elif "withdrawn" in status_raw:
                findings.append(
                    CitationFinding(
                        cited_raw=raw,
                        standard_number=canonical_is,
                        cited_year=cited_year,
                        current_standard=canonical_is,
                        current_year=current_year or None,
                        current_title=current_title,
                        status="withdrawn",
                        context_snippet=snippet,
                        action_required=f"Standard {canonical_is} has been withdrawn by BIS without direct replacement.",
                    )
                )
            elif cited_year and current_year and cited_year != current_year:
                # Year mismatch
                try:
                    is_older = int(cited_year) < int(current_year)
                except ValueError:
                    is_older = True

                if is_older:
                    findings.append(
                        CitationFinding(
                            cited_raw=raw,
                            standard_number=canonical_is,
                            cited_year=cited_year,
                            current_standard=f"{canonical_is}:{current_year}",
                            current_year=current_year,
                            current_title=current_title,
                            status="older_edition",
                            context_snippet=snippet,
                            action_required=f"Update specification from older edition {cited_year} to current {current_year} edition.",
                        )
                    )
                else:
                    findings.append(
                        CitationFinding(
                            cited_raw=raw,
                            standard_number=canonical_is,
                            cited_year=cited_year,
                            current_standard=f"{canonical_is}:{current_year}",
                            current_year=current_year,
                            current_title=current_title,
                            status="current",
                            context_snippet=snippet,
                            action_required="Citation is aligned with current published edition.",
                        )
                    )
            else:
                findings.append(
                    CitationFinding(
                        cited_raw=raw,
                        standard_number=canonical_is,
                        cited_year=cited_year,
                        current_standard=f"{canonical_is}:{current_year}" if current_year else canonical_is,
                        current_year=current_year or None,
                        current_title=current_title,
                        status="current",
                        context_snippet=snippet,
                        action_required="Citation is aligned with active BIS catalogue edition.",
                    )
                )

        outdated_count = sum(1 for f in findings if f.status in ("older_edition", "superseded", "withdrawn"))
        report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"

        return OutdatedReferenceReport(
            report_id=report_id,
            doc_name=doc_name,
            total_citations=len(findings),
            outdated_count=outdated_count,
            findings=findings,
        )
