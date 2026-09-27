import re
from typing import Any, Dict, List, Optional, Tuple

from bisveda.routing.contracts import CanonicalIntent


class IntentClassifier:
    """
    Stage 2 Intent & Entity Classifier (Canonical Spec §3.1).
    Classifies queries into the 14 Canonical Intents and extracts domain entities
    and missing attributes for downstream agent specialization.
    """

    # Keyword and regex patterns for the 14 Canonical Intents
    INTENT_PATTERNS = [
        # 1. Hallmarking & AHC
        (re.compile(r"\b(?:huid|hallmark|hallmarking|gold\s+purity|silver\s+purity|carat|karat)\b", re.IGNORECASE), CanonicalIntent.HALLMARKING),
        (re.compile(r"\b(?:ahc|assaying\s+and\s+hallmarking|assaying\s+centre)\b", re.IGNORECASE), CanonicalIntent.AHC_SEARCH),
        
        # 2. Consumer Verification & Complaints
        (re.compile(r"\b(?:(?:verify|check)\s+(?:cm/?l|license|isi|registration|genuine)|cml\s+number)\b", re.IGNORECASE), CanonicalIntent.CONSUMER_VERIFICATION),
        (re.compile(r"\b(?:fake\s+isi|misuse\s+of\s+isi|complaint|substandard\s+product|report\s+fraud|defective)\b", re.IGNORECASE), CanonicalIntent.CONSUMER_COMPLAINT),
        
        # 3. QCO & Statutory Mandates
        (re.compile(r"\b(?:qco|quality\s+control\s+order|is\s+it\s+mandatory|mandatory\s+certification|gazette|section\s+29|compulsory\s+under)\b", re.IGNORECASE), CanonicalIntent.QCO_CHECK),
        
        # 4. Certification & Licensing
        (re.compile(r"\b(?:how\s+to\s+get\s+isi|apply\s+for\s+license|scheme\s*[-–]?\s*[iI|1]|scheme\s*[-–]?\s*[iI]{2}|scheme\s*[-–]?\s*[iI]{4}|certification\s+process|license\s+fee|concession|msme\s+subsidy)\b", re.IGNORECASE), CanonicalIntent.CERTIFICATION_GUIDANCE),
        
        # 5. Laboratory & Testing
        (re.compile(r"\b(?:labs?|testing\s+labs?|laborator(?:y|ies)|nabl|test\s+facility|where\s+to\s+test|testing\s+charges)\b", re.IGNORECASE), CanonicalIntent.LAB_SEARCH),
        
        # 6. Comparison & Edition Diffs
        (re.compile(r"\b(?:compare|difference\s+between|vs\.?|versus|revision\s+changes|superseded\s+by)\b", re.IGNORECASE), CanonicalIntent.COMPARISON),
        
        # 7. Document Review
        (re.compile(r"\b(?:review\s+tender|check\s+document|outdated\s+references?|tender\s+specs?|boq\s+audit)\b", re.IGNORECASE), CanonicalIntent.DOCUMENT_REVIEW),
        
        # 8. Forms & Application Templates
        (re.compile(r"\b(?:form\s+[ivxIVX\d]+|sti|scheme\s+of\s+testing|application\s+format|sample\s+test\s+report)\b", re.IGNORECASE), CanonicalIntent.FORM_PREPARATION),
        
        # 9. Education & Training
        (re.compile(r"\b(?:standards\s+club|nits|training\s+programme|internship|academic\s+committee|student)\b", re.IGNORECASE), CanonicalIntent.EDUCATION_TRAINING),
        
        # 10. Technical Clause Q&A
        (re.compile(r"\b(?:clause\s+\d+|clause|tensile\s+strength|hydraulic\s+test|burst\s+pressure|nominal\s+diameter|thickness\s+limit|tolerance|test\s+method)\b", re.IGNORECASE), CanonicalIntent.TECHNICAL_QA),
        
        # 11. Direct Standard Lookup
        (re.compile(r"^(?:IS\s*\d+|what\s+is\s+IS\s*\d+|tell\s+me\s+about\s+IS\s*\d+)", re.IGNORECASE), CanonicalIntent.STANDARD_LOOKUP),
    ]

    # Entity Regex Patterns
    CML_PATTERN = re.compile(r"\b(?:CM/?L[-:\s]*)?(\d{7,8})\b", re.IGNORECASE)
    HUID_PATTERN = re.compile(r"\b([A-Z0-9]{6})\b")
    PIN_PATTERN = re.compile(r"\b(\d{6})\b")
    CAPACITY_PATTERN = re.compile(r"\b(\d+(?:\.\d+)?)\s*(litres?|liters?|ltrs?|l|ml|kg|gms?|grams?|tonnes?|mm|meters?|m)\b", re.IGNORECASE)

    KNOWN_MATERIALS = [
        "stainless steel", "aluminium", "aluminum", "copper", "brass",
        "mild steel", "carbon steel", "tmt steel", "cast iron",
        "gold", "silver", "platinum",
        "polyethylene", "polypropylene", "pvc", "hdpe", "ldpe", "pet", "polycarbonate",
        "clay", "ceramic", "glass", "rubber", "cotton", "polyester"
    ]

    KNOWN_INTENDED_USES = [
        "domestic", "commercial", "industrial", "medical", "automotive",
        "agricultural", "construction", "drinking", "food grade"
    ]

    KNOWN_CITIES = [
        "nagpur", "delhi", "new delhi", "mumbai", "bengaluru", "bangalore",
        "chennai", "kolkata", "hyderabad", "ahmedabad", "pune", "surat",
        "jaipur", "lucknow", "kanpur", "indore", "bhopal", "patna", "vadodara",
        "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi",
        "srinagar", "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad",
        "prayagraj", "ranchi", "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada",
        "jodhpur", "madurai", "raipur", "kota", "chandigarh", "guwahati", "solapur",
        "hubli", "dharwad", "bareilly", "moradabad", "mysore", "gurgaon", "gurugram",
        "aligarh", "jalandhar", "tiruchirappalli", "bhubaneswar", "salem", "mira bhayandar",
        "thiruvananthapuram", "bhiwandi", "saharanpur", "gorakhpur", "guntur", "bikaner",
        "amravati", "noida", "jamshedpur", "bhilai", "cuttack", "firozabad", "kochi",
        "cochin", "nellore", "bhavnagar", "dehradun", "durgapur", "asansol", "rourkela"
    ]

    def classify(self, query: str) -> CanonicalIntent:
        clean_q = query.strip()
        for pattern, intent in self.INTENT_PATTERNS:
            if pattern.search(clean_q):
                return intent
        return CanonicalIntent.PRODUCT_MATCH

    def extract_entities(self, query: str) -> Tuple[Dict[str, Any], List[str]]:
        entities: Dict[str, Any] = {}
        missing_attrs: List[str] = []
        lower_q = query.lower()

        # 1. Material
        found_mat = None
        for mat in self.KNOWN_MATERIALS:
            if mat in lower_q:
                found_mat = mat
                break
        if found_mat:
            entities["material"] = found_mat

        # 2. Intended Use
        found_use = None
        for use in self.KNOWN_INTENDED_USES:
            if use in lower_q:
                found_use = use
                break
        if found_use:
            entities["intended_use"] = found_use

        # 3. Capacity / Dimensions
        cap_match = self.CAPACITY_PATTERN.search(query)
        if cap_match:
            entities["capacity"] = cap_match.group(0).strip()

        # 4. City / PIN Code
        pin_match = self.PIN_PATTERN.search(query)
        if pin_match:
            entities["pin"] = pin_match.group(1)

        found_city = None
        for city in self.KNOWN_CITIES:
            if re.search(rf"\b{city}\b", lower_q):
                found_city = city.title()
                break
        if found_city:
            entities["city"] = found_city

        # 5. CM/L Number check
        if "cml" in lower_q or "cm/l" in lower_q or "license" in lower_q:
            cml_match = self.CML_PATTERN.search(query)
            if cml_match:
                entities["cml_number"] = cml_match.group(1)

        # 6. HUID check
        if "huid" in lower_q or "hallmark" in lower_q:
            huid_match = self.HUID_PATTERN.search(query.upper())
            if huid_match:
                entities["huid"] = huid_match.group(1)

        # 7. Disambiguation / Missing Attributes Detection
        if "pressure cooker" in lower_q:
            if not found_mat:
                missing_attrs.append("material (e.g. Stainless Steel vs Aluminium)")
            if "capacity" not in entities:
                missing_attrs.append("capacity (e.g. 3L, 5L, or 10L)")
        elif "drinking water" in lower_q or "packaged water" in lower_q:
            if "natural" not in lower_q and "mineral" not in lower_q:
                missing_attrs.append("type (Packaged Drinking Water IS 14543 vs Natural Mineral Water IS 13428)")
        elif "steel" in lower_q or "rebar" in lower_q or "tmt" in lower_q:
            if not found_use:
                missing_attrs.append("application (Reinforced Concrete IS 1786 vs Structural Steel IS 2062)")

        return entities, missing_attrs
