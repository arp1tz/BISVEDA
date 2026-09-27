from typing import List
from bisveda.contracts.adjudication import ApplicabilityClass, KnowledgeTier
from bisveda.contracts.evidence import EvidencePackage

class EvidenceOnlySynthesizer:
    """
    Synthesizes compliant, deterministic prose from an EvidencePackage
    without requiring any external LLM inference (Rule 6: GENERATION=none).
    """

    def synthesize(self, pkg: EvidencePackage) -> str:
        adj = pkg.adjudication

        # Scenario 1: Honest Abstention (Out of corpus or below relevance floor)
        if adj.out_of_corpus or not adj.candidates:
            return (
                "**Regulated Safety Gate Notice**\n\n"
                f"Your query '{pkg.original_query}' does not match any current Indian Standard with sufficient legal certainty "
                f"(top relevance score is below the minimum threshold of {adj.relevance_floor:.2f}).\n\n"
                "To prevent misleading regulatory advice, BISVEDA has abstained from generating speculative requirements. "
                "For official clarification regarding novel or unlisted products, please contact the **National Standards Helpline at 14434** "
                "or consult the official BIS portal at https://www.services.bis.gov.in."
            )

        # Scenario 2: Active Standards Identified
        paragraphs: List[str] = []
        top_cand = adj.candidates[0]

        # Standard identification
        citable_top = next((item for item in pkg.citable_evidence if item.standard_id == top_cand.standard_id), None)
        cit_tag = f"[{citable_top.sid}]" if citable_top else ""

        if top_cand.applicability == ApplicabilityClass.DIRECTLY_APPLICABLE:
            paragraphs.append(
                f"Based on verified BIS records, your product is directly governed by **{top_cand.is_number}** {cit_tag}. "
                "Compliance with this Indian Standard is mandatory under current Quality Control Orders (QCOs) prior to commercial sale or import."
            )
        elif top_cand.applicability == ApplicabilityClass.RELATED_MATERIAL_MISMATCH:
            user_mat = pkg.entities.get("material", "specified material")
            paragraphs.append(
                f"**Material Mismatch Advisory**: You requested standards for a product manufactured using '{user_mat}', "
                f"whereas the primary catalog match **{top_cand.is_number}** {cit_tag} is formulated for a different material scope. "
                "Review the exact standard scope to verify whether an amendment or alternative standard applies."
            )
        else:
            paragraphs.append(
                f"The standard **{top_cand.is_number}** {cit_tag} has been identified as potentially applicable to your inquiry. "
                "Review the specific product parameters below to confirm regulatory scope."
            )

        # Testing requirements
        testing_items = [
            item for item in pkg.citable_evidence
            if item.kind == "clause_text" and item.standard_id == top_cand.standard_id
        ]
        if testing_items:
            test_lines = []
            for t in testing_items:
                test_lines.append(f"- **[{t.sid}]** {t.snippet}")
            paragraphs.append(
                "**Mandatory Safety Testing Requirements**:\n" + "\n".join(test_lines)
            )
        elif top_cand.tier == KnowledgeTier.TIER_A:
            paragraphs.append(
                "**Testing Parameters**: Specific test thresholds for this standard are classified under Tier A "
                "(catalogue record); refer to official licensed copies on Manak Online for proprietary numeric limits."
            )

        # Certification pathway
        paragraphs.append(
            "**Certification Pathway**: Eligible manufacturers must apply under **Scheme-I (ISI Mark)** via the "
            "Manak Online portal (https://www.manakonline.in). Micro, Small, and Medium Enterprises (MSMEs) and recognized Startups "
            "are entitled to an **80% concession on application and annual marking fees** under the 30-day simplified fast-track procedure."
        )

        return "\n\n".join(paragraphs)
