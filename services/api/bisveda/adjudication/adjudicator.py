from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional

from bisveda.contracts.adjudication import (
    Adjudication,
    ApplicabilityClass,
    CandidateAdjudication,
    CandidateCoverage,
    ConfidenceLabel,
    ConflictRecord,
    DimensionCoverage,
    GroundingState,
    KnowledgeTier,
)
from bisveda.contracts.evidence import (
    CitableEvidenceItem,
    EvidenceClass,
    EvidencePackage,
    NonCitableContextItem,
)

class EvidenceAdjudicator:
    """
    Deterministic Adjudication Engine (Rule 2 & D35).
    Computes applicability, grounding state, confidence label, knowledge tier,
    claim policy, and evidence package before any LLM generation.
    """

    def __init__(self, relevance_floor: float = 0.45):
        self.relevance_floor = relevance_floor

    def adjudicate(
        self,
        query_id: str,
        query: str,
        intent: str = "product_match",
        candidates: Optional[List[Dict[str, Any]]] = None,
        entities: Optional[Dict[str, Any]] = None,
        language: str = "en",
    ) -> EvidencePackage:
        candidates = candidates or []
        entities = entities or {}
        now_iso = datetime.now(timezone.utc).isoformat()

        user_context_item = NonCitableContextItem(
            evidence_class=EvidenceClass.USER_PROVIDED,
            kind="business_context",
            text=query,
        )

        # Gate 1: Check candidate existence and relevance floor
        if not candidates:
            adjudication = Adjudication(
                grounding_state=GroundingState.INSUFFICIENT_EVIDENCE,
                confidence_label=ConfidenceLabel.NO_VERIFIED_EVIDENCE,
                relevance_top1=0.0,
                relevance_floor=self.relevance_floor,
                out_of_corpus=True,
                candidates=[],
                conflicts=[],
            )
            return EvidencePackage(
                query_id=query_id,
                canonical_query=query,
                original_query=query,
                language=language,
                intent=intent,
                entities=entities,
                adjudication=adjudication,
                citable_evidence=[],
                context_non_citable=[user_context_item],
                structured_data={
                    "status": "abstained",
                    "reason": "BISVEDA answers from the BIS catalogue and public BIS documents it has indexed; it found nothing that supports an answer to this query. Official route: consult standards.bis.gov.in.",
                    "named_boundary_refusal": True,
                },
                suggestions=["Check spelling of product name", "Search by broad category, e.g., 'pressure cooker', 'cement'", "Consult official portal: standards.bis.gov.in"],
            )

        top1_relevance = float(candidates[0].get("relevance_score", 0.0))
        if top1_relevance < self.relevance_floor:
            adjudication = Adjudication(
                grounding_state=GroundingState.INSUFFICIENT_EVIDENCE,
                confidence_label=ConfidenceLabel.NO_VERIFIED_EVIDENCE,
                relevance_top1=round(top1_relevance, 3),
                relevance_floor=self.relevance_floor,
                out_of_corpus=True,
                candidates=[],
                conflicts=[],
            )
            return EvidencePackage(
                query_id=query_id,
                canonical_query=query,
                original_query=query,
                language=language,
                intent=intent,
                entities=entities,
                adjudication=adjudication,
                citable_evidence=[],
                context_non_citable=[user_context_item],
                structured_data={
                    "status": "abstained",
                    "reason": "BISVEDA answers from the BIS catalogue and public BIS documents it has indexed; it found nothing that supports an answer to this query. Official route: consult standards.bis.gov.in.",
                    "relevance_score": top1_relevance,
                    "relevance_floor": self.relevance_floor,
                    "named_boundary_refusal": True,
                },
                suggestions=["Call National Standards Helpline: 14434", "Verify if the product is regulated under a different ministry.", "Consult official portal: standards.bis.gov.in"],
            )

        # Gate 2: Deterministic candidate dimension analysis
        candidate_adjudications: List[CandidateAdjudication] = []
        citable_items: List[CitableEvidenceItem] = []
        conflicts: List[ConflictRecord] = []
        citable_counter = 1

        user_material = entities.get("material", "").lower().strip()
        user_product = entities.get("product", "").lower().strip()

        for cand in candidates:
            standard_id = cand.get("standard_id", "")
            is_number = cand.get("standard_number") or cand.get("is_number", "IS Unknown")
            std_title = cand.get("full_title", "").lower()
            std_materials = [m.lower() for m in cand.get("materials", [])]
            cand_score = float(cand.get("relevance_score", 0.0))

            # Dimension evaluations
            prod_cov = DimensionCoverage.COVERED if cand_score >= 0.50 else DimensionCoverage.NOT_COVERED
            
            # Material evaluation
            mat_cov = DimensionCoverage.UNKNOWN
            material_mismatch = False
            if user_material:
                # Check if user specified material clashes with standard
                if "aluminium" in user_material and ("stainless steel" in std_title or "stainless steel" in std_materials):
                    material_mismatch = True
                    mat_cov = DimensionCoverage.NOT_COVERED
                elif "stainless steel" in user_material and ("aluminium" in std_title or "aluminium" in std_materials):
                    material_mismatch = True
                    mat_cov = DimensionCoverage.NOT_COVERED
                elif any(user_material in m for m in std_materials) or user_material in std_title:
                    mat_cov = DimensionCoverage.COVERED
                else:
                    mat_cov = DimensionCoverage.NOT_COVERED

            # Determine Applicability Class
            if material_mismatch:
                applicability = ApplicabilityClass.RELATED_MATERIAL_MISMATCH
            elif cand_score >= 0.75 and prod_cov == DimensionCoverage.COVERED:
                applicability = ApplicabilityClass.DIRECTLY_APPLICABLE
            elif cand_score >= 0.55:
                applicability = ApplicabilityClass.POTENTIALLY_APPLICABLE
            else:
                applicability = ApplicabilityClass.RELATED_STANDARD

            # Determine Tier
            # Tier C if technical test clauses are present in candidate
            key_tests = cand.get("key_testing_parameters") or cand.get("testing_parameters") or []
            if key_tests:
                tier = KnowledgeTier.TIER_C
                claim_policy = ["identity", "description", "why", "paragraph", "clause", "numeric"]
            elif cand.get("mandatory_qco") or cand.get("qco_date"):
                tier = KnowledgeTier.TIER_B
                claim_policy = ["identity", "description", "why", "paragraph", "qco_dates"]
            else:
                tier = KnowledgeTier.TIER_A
                claim_policy = ["identity", "description", "why"]

            coverage = CandidateCoverage(
                product=prod_cov,
                material=mat_cov,
                intended_use=DimensionCoverage.COVERED if "domestic" in query.lower() or "household" in query.lower() else DimensionCoverage.UNKNOWN,
                testing=DimensionCoverage.COVERED if key_tests else DimensionCoverage.NOT_COVERED,
                certification=DimensionCoverage.COVERED if cand.get("scheme") else DimensionCoverage.UNKNOWN,
            )

            cand_adj = CandidateAdjudication(
                standard_id=standard_id,
                is_number=is_number,
                applicability=applicability,
                coverage=coverage,
                tier=tier,
                claim_policy=claim_policy,
            )
            candidate_adjudications.append(cand_adj)

            # Generate Citable Items for directly applicable or material mismatch standards
            if applicability in (ApplicabilityClass.DIRECTLY_APPLICABLE, ApplicabilityClass.RELATED_MATERIAL_MISMATCH):
                sid = f"S{citable_counter}"
                citable_counter += 1
                citable_items.append(
                    CitableEvidenceItem(
                        sid=sid,
                        evidence_class=EvidenceClass.OFFICIAL_SOURCE,
                        tier=tier,
                        kind="catalogue_record",
                        standard_id=standard_id,
                        locator=f"{is_number} Scope & Title",
                        snippet=f"{is_number}: {cand.get('full_title', '')}. Scope: {cand.get('scope', 'Indian Standard specification')}.",
                        source_url=cand.get("source_url") or "https://www.services.bis.gov.in",
                        retrieved_at=now_iso,
                    )
                )

                # Add testing clauses if Tier C
                if tier == KnowledgeTier.TIER_C and key_tests:
                    for test_param in key_tests[:2]:
                        sid_test = f"S{citable_counter}"
                        citable_counter += 1
                        test_str = test_param if isinstance(test_param, str) else str(test_param)
                        citable_items.append(
                            CitableEvidenceItem(
                                sid=sid_test,
                                evidence_class=EvidenceClass.OFFICIAL_SOURCE,
                                tier=tier,
                                kind="clause_text",
                                standard_id=standard_id,
                                locator=f"{is_number} Essential Testing",
                                snippet=f"Mandatory safety testing parameter: {test_str}.",
                                source_url=cand.get("source_url") or "https://www.services.bis.gov.in",
                                retrieved_at=now_iso,
                            )
                        )

        # Grounding state determination
        has_directly_applicable = any(c.applicability == ApplicabilityClass.DIRECTLY_APPLICABLE for c in candidate_adjudications)
        if has_directly_applicable and top1_relevance >= 0.85:
            grounding_state = GroundingState.VERIFIED
            confidence_label = ConfidenceLabel.VERIFIED_EVIDENCE
        elif has_directly_applicable:
            grounding_state = GroundingState.SUPPORTED_INFERENCE
            confidence_label = ConfidenceLabel.PARTIALLY_SUPPORTED
        else:
            grounding_state = GroundingState.SUPPORTED_INFERENCE
            confidence_label = ConfidenceLabel.LIMITED_EVIDENCE

        adjudication = Adjudication(
            grounding_state=grounding_state,
            confidence_label=confidence_label,
            relevance_top1=round(top1_relevance, 3),
            relevance_floor=self.relevance_floor,
            out_of_corpus=False,
            candidates=candidate_adjudications,
            conflicts=conflicts,
        )

        return EvidencePackage(
            query_id=query_id,
            canonical_query=query,
            original_query=query,
            language=language,
            intent=intent,
            entities=entities,
            adjudication=adjudication,
            citable_evidence=citable_items,
            context_non_citable=[user_context_item],
            structured_data={
                "top_candidate": candidate_adjudications[0].is_number if candidate_adjudications else None,
                "applicability": candidate_adjudications[0].applicability.value if candidate_adjudications else None,
            },
            official_links=[
                {"title": "BIS Portal", "url": "https://www.bis.gov.in"},
                {"title": "Manak Online", "url": "https://www.manakonline.in"},
            ],
            suggestions=["Review mandatory testing parameters", "Check testing laboratory availability in your region"],
        )
