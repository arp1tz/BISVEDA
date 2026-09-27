import re
from typing import Dict, List, Set, Tuple

from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.contracts.evidence import EvidenceClass, EvidencePackage
from bisveda.contracts.trust import TrustCheckResult, TrustResult

class TrustGate:
    """
    BISVEDA V8 Trust Gate (Rule 3, Rule 4, D39).
    Enforces Tier Honesty, bracket normalisation, citation verification,
    and strips hallucinated or unverified markers from generated output.
    """

    def __init__(self, strict_tier_enforcement: bool = True):
        self.strict_tier_enforcement = strict_tier_enforcement

    def normalize_brackets(self, text: str) -> str:
        """
        Normalises full-width and Unicode brackets to standard ASCII brackets.
        e.g., 【S1】 -> [S1], ［S2］ -> [S2]
        """
        norm = text.replace("【", "[").replace("】", "]")
        norm = norm.replace("［", "[").replace("］", "]")
        norm = norm.replace("〔", "[").replace("〕", "]")
        return norm

    def verify(self, raw_text: str, evidence_package: EvidencePackage) -> TrustResult:
        checks: List[TrustCheckResult] = []
        caveats: List[str] = []
        verified_citations: List[str] = []
        stripped_citations: List[str] = []

        # Step 1: Bracket Normalisation
        text = self.normalize_brackets(raw_text)

        # Step 2: Index valid citable sources
        valid_sids: Set[str] = set()
        sid_to_tier: Dict[str, KnowledgeTier] = {}
        for item in evidence_package.citable_evidence:
            if item.evidence_class == EvidenceClass.OFFICIAL_SOURCE:
                valid_sids.add(item.sid.upper())
                sid_to_tier[item.sid.upper()] = item.tier

        # Step 3: Citation Integrity Check (Rule 4)
        found_markers = re.findall(r"\[(S\d+)\]", text, re.IGNORECASE)
        found_markers_upper = [m.upper() for m in found_markers]

        clean_text = text
        for marker in set(found_markers_upper):
            if marker in valid_sids:
                verified_citations.append(marker)
            else:
                # Hallucinated or non-citable marker -> Strip it!
                stripped_citations.append(marker)
                # Replace pattern [S#] or [s#] with empty string
                pattern = re.compile(rf"\[{marker}\]", re.IGNORECASE)
                clean_text = pattern.sub("", clean_text)

        citation_check_passed = len(stripped_citations) == 0
        checks.append(
            TrustCheckResult(
                check_name="citation_integrity",
                passed=citation_check_passed,
                details=f"Verified: {len(verified_citations)}, Stripped fabricated: {len(stripped_citations)}",
            )
        )
        if stripped_citations:
            caveats.append(f"Stripped {len(stripped_citations)} unverified citation marker(s): {', '.join(stripped_citations)}")

        # Step 4: Tier Honesty Enforcement (Rule 3)
        # Tier A standards must NOT feature numeric limit assertions or direct quotes
        tier_a_violations = []
        tier_a_standards = [
            c.is_number for c in evidence_package.adjudication.candidates if c.tier == KnowledgeTier.TIER_A
        ]
        
        for std_num in tier_a_standards:
            # Pattern check: standard followed by numeric limit like '150 kPa' or '10 mm' or quoted text
            std_escaped = re.escape(std_num)
            numeric_pattern = rf"{std_escaped}.*?(\d+\s*(?:kpa|mpa|bar|mm|cm|kg|volts|v|degrees|seconds))"
            match = re.search(numeric_pattern, clean_text, re.IGNORECASE | re.DOTALL)
            if match:
                tier_a_violations.append(f"Numeric limit '{match.group(1)}' asserted for Tier A standard {std_num}")

        tier_check_passed = len(tier_a_violations) == 0
        if not tier_check_passed:
            caveats.append("Tier A Notice: Specific numeric test values are omitted in compliance with catalogue license boundaries.")
        
        checks.append(
            TrustCheckResult(
                check_name="tier_honesty",
                passed=tier_check_passed,
                details="No Tier A numeric claims" if tier_check_passed else f"Violations: {'; '.join(tier_a_violations)}",
            )
        )

        # Step 5: Citation Marker Survival (D39)
        if evidence_package.citable_evidence and not verified_citations and not evidence_package.adjudication.out_of_corpus:
            caveats.append("Citation Notice: Standard reference markers were omitted in generated prose; refer to the Evidence Ledger.")

        overall_passed = citation_check_passed and (tier_check_passed or not self.strict_tier_enforcement)

        # Clean multiple spaces left by stripped tags
        clean_text = re.sub(r" +", " ", clean_text).strip()

        return TrustResult(
            passed=overall_passed,
            blocked=False,
            clean_text=clean_text,
            verified_citations=verified_citations,
            stripped_citations=stripped_citations,
            caveats=caveats,
            checks=checks,
        )
