from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.contracts.dossier import (
    ComplianceDossier,
    DossierCertificationRoute,
    DossierInterpretation,
    DossierLabItem,
    DossierRegulatory,
    DossierStandardItem,
    DossierTesting,
    DossierTrust,
)
from bisveda.contracts.evidence import EvidencePackage
from bisveda.contracts.trust import TrustResult

class DossierBuilder:
    """
    Builds the formal ComplianceDossier contract from an EvidencePackage,
    TrustResult, and seed registries (QCOs, Schemes, Labs).
    """

    def __init__(self, data_dir: Optional[Path] = None):
        repo_root = Path(__file__).resolve().parents[4]
        self.data_dir = data_dir or repo_root / "data" / "seed"
        self._load_seed_caches()

    def _load_seed_caches(self):
        self.labs: List[Dict[str, Any]] = []
        labs_file = self.data_dir / "laboratories.json"
        if labs_file.exists():
            try:
                with open(labs_file, "r", encoding="utf-8") as f:
                    self.labs = json.load(f)
            except Exception:
                self.labs = []

        self.qcos: List[Dict[str, Any]] = []
        qcos_file = self.data_dir / "qcos.json"
        if qcos_file.exists():
            try:
                with open(qcos_file, "r", encoding="utf-8") as f:
                    self.qcos = json.load(f)
            except Exception:
                self.qcos = []

    def build(
        self,
        pkg: EvidencePackage,
        trust_result: TrustResult,
        user_type: str = "msme",
        market: str = "domestic",
    ) -> ComplianceDossier:
        now_iso = datetime.now(timezone.utc).isoformat()
        dossier_id = f"DOS-{uuid.uuid4().hex[:8].upper()}"
        adj = pkg.adjudication

        # 1. Interpretation
        interpretation = DossierInterpretation(
            product=pkg.entities.get("product"),
            material=pkg.entities.get("material"),
            intended_use=pkg.entities.get("intended_use") or market,
            user_type=user_type,
            market=market,
        )

        # 2. Standards List
        standards_items: List[DossierStandardItem] = []
        primary_is_number = None
        for cand in adj.candidates:
            if not primary_is_number:
                primary_is_number = cand.is_number
            std_citable = next((s for s in pkg.citable_evidence if s.standard_id == cand.standard_id), None)
            standards_items.append(
                DossierStandardItem(
                    standard_id=cand.standard_id,
                    is_number=cand.is_number,
                    title=f"Indian Standard {cand.is_number}",
                    applicability=cand.applicability,
                    why_coverage=f"Coverage: Product={cand.coverage.product.value}, Material={cand.coverage.material.value}",
                    tier=cand.tier,
                    status="Active",
                    official_url=std_citable.source_url if std_citable else "https://www.services.bis.gov.in",
                )
            )

        # 3. Regulatory / QCO
        qco_status = "mandatory" if primary_is_number else "under_review"
        qco_ref = None
        qco_ministry = "Ministry of Consumer Affairs / DPIIT"
        if primary_is_number:
            norm_primary = primary_is_number.replace(" ", "").upper()
            for q in self.qcos:
                q_std = (q.get("standard_number") or "").replace(" ", "").upper()
                stds_covered = [str(s).replace(" ", "").upper() for s in (q.get("standards_covered") or [])]
                if norm_primary == q_std or any(norm_primary in s for s in stds_covered):
                    legal = q.get("legal_source") or {}
                    qco_ref = (
                        q.get("order_title")
                        or q.get("order_number")
                        or (legal.get("gazette_order") if isinstance(legal, dict) else None)
                    )
                    if isinstance(legal, dict) and legal.get("issuing_ministry"):
                        qco_ministry = legal.get("issuing_ministry")
                    elif q.get("ministry"):
                        qco_ministry = q.get("ministry")
                    break
        if not qco_ref and primary_is_number:
            qco_ref = f"Quality Control Order for {primary_is_number}"

        regulatory = DossierRegulatory(
            qco_status=qco_status,
            order_reference=qco_ref,
            enforcement_date="Enforced (Immediate)",
            ministry=qco_ministry,
            penal_provision="Section 29 of BIS Act, 2016 (Imprisonment up to 2 years or fine up to ₹5,00,000)",
        )

        # 4. Certification Route
        is_msme = user_type.lower() in ("msme", "startup")
        app_fee = 200 if is_msme else 1000
        audit_fee = 1400 if is_msme else 7000
        cert_route = DossierCertificationRoute(
            scheme_name="Scheme-I (ISI Mark Certification)",
            eligibility_result="Eligible for 30-Day MSME Simplified Fast-Track Procedure" if is_msme else "Standard Option 1 / Option 2",
            steps=[
                "Step 1: In-house testing setup & manufacturing capability inspection",
                "Step 2: Submission of Form-I application on Manak Online",
                "Step 3: Factory audit & independent testing sample draw",
                "Step 4: Grant of BIS License (CM/L number) within 30 days (MSME track)",
            ],
            required_documents=[
                "Udyam MSME Registration Certificate (for 80% fee subsidy)",
                "Factory premises lease/ownership deed and plant layout",
                "List of manufacturing machinery and in-house testing equipment",
                "Test certificate of raw materials from accredited laboratory",
            ],
            indicative_fee={
                "application_fee_inr": app_fee,
                "audit_fee_per_day_inr": audit_fee,
                "msme_subsidy_percentage": 80 if is_msme else 0,
                "annual_marking_fee_structure": "Volume-tiered minimum with 80% MSME concession",
            },
            portal_name="Manak Online",
            portal_url="https://www.manakonline.in",
        )

        # 5. Testing
        testing_clauses = []
        for item in pkg.citable_evidence:
            if item.kind == "clause_text":
                testing_clauses.append({
                    "sid": item.sid,
                    "locator": item.locator,
                    "description": item.snippet,
                })
        
        has_tier_c = any(c.tier == KnowledgeTier.TIER_C for c in adj.candidates)
        testing = DossierTesting(
            tier_permits_testing=has_tier_c,
            notice=None if has_tier_c else "Standard is classified under Tier A; refer to licensed specification for proprietary limits.",
            clauses=testing_clauses,
        )

        # 6. Labs
        lab_items: List[DossierLabItem] = []
        matched_count = 0
        if primary_is_number:
            norm_target = primary_is_number.replace(" ", "").upper()
            for l in self.labs:
                scope = l.get("scope_standards") or l.get("tested_standards") or []
                scope_norm = [s.replace(" ", "").upper() for s in scope]
                if norm_target in scope_norm or any(norm_target in s for s in scope_norm):
                    lab_items.append(
                        DossierLabItem(
                            name=l.get("lab_name") or l.get("name", "Recognized Lab"),
                            city=l.get("city", "New Delhi"),
                            state=l.get("state", "Delhi"),
                            accreditation_number=l.get("accreditation_number") or l.get("bis_lab_code"),
                            distance_km=None,
                        )
                    )
                    matched_count += 1
                    if matched_count >= 5:
                        break

        # Fallback to general central labs if none matched specifically
        if not lab_items and self.labs:
            for l in self.labs[:3]:
                lab_items.append(
                    DossierLabItem(
                        name=l.get("lab_name") or l.get("name", "Central BIS Laboratory"),
                        city=l.get("city", "Sahibabad"),
                        state=l.get("state", "Uttar Pradesh"),
                        accreditation_number=l.get("bis_lab_code", "BIS-CENTRAL-01"),
                    )
                )

        # 7. Next Actions
        next_actions = [
            "Verify in-house testing equipment against the Standard Test Plan (STI)",
            "Download Form-I Schedule-II draft checklist from Manak Online",
            "Contact an accredited testing laboratory for third-party pre-audit test",
            "Submit online application under Udyam certificate for 80% fee discount",
        ]

        # 8. Trust
        dossier_trust = DossierTrust(
            grounding_state=adj.grounding_state,
            confidence_label=adj.confidence_label,
            relevance_score=adj.relevance_top1,
            caveats=trust_result.caveats,
        )

        return ComplianceDossier(
            dossier_id=dossier_id,
            created_at=now_iso,
            query_id=pkg.query_id,
            language=pkg.language,
            interpretation=interpretation,
            standards=standards_items,
            regulatory=regulatory,
            certification_route=cert_route,
            testing=testing,
            labs=lab_items,
            next_actions=next_actions,
            evidence_ledger=pkg.citable_evidence,
            summary=trust_result.clean_text,
            trust=dossier_trust,
        )
