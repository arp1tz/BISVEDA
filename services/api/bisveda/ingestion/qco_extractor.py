import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QCOMeta(BaseModel):
    so_number: Optional[str] = None
    ministry: str = "Ministry of Consumer Affairs, Food and Public Distribution"
    department: Optional[str] = None
    order_title: str = "Quality Control Order"
    enforcement_date: str = "Immediate upon publication in the Official Gazette"
    mandatory_status: str = "Strictly Mandatory (Section 29 BIS Act, 2016)"
    penal_provisions: str = "Section 29 BIS Act, 2016 (Imprisonment up to 2 years or fine not less than ₹2,00,000 or both)"
    standards_covered: List[str] = Field(default_factory=list)
    applicability_scope: str = "All domestic manufacturers and importers"
    exemptions: List[str] = Field(default_factory=list)


class QCOExtractor:
    """
    Specialized Extractor for Gazette Notifications and Quality Control Orders (QCOs).
    Extracts statutory S.O. numbers, publishing ministry, enforcement timelines,
    mandatory conformity requirements, and Section 29 BIS Act penal clauses.
    """

    def __init__(self):
        self.so_regex = re.compile(
            r"\b(S\.?O\.?\s*\d+\s*(?:\([A-Z]\))?|G\.?S\.?R\.?\s*\d+\s*(?:\([A-Z]\))?)",
            re.IGNORECASE,
        )
        self.is_regex = re.compile(
            r"\b(IS\s*[:\-]?\s*\d+(?:\s*(?:Part\s*\d+|Pt\s*\d+))?(?:\s*:\s*\d{4})?)\b",
            re.IGNORECASE,
        )
        self.date_regex = re.compile(
            r"\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})\b",
            re.IGNORECASE,
        )

    def extract(self, text: str, fallback_title: str = "Quality Control Order") -> QCOMeta:
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        # 1. Gazette S.O. number
        so_match = self.so_regex.search(text)
        so_number = so_match.group(1).upper() if so_match else None

        # Clean S.O. format
        if so_number:
            so_number = re.sub(r"\s+", " ", so_number)
            if not so_number.startswith("S.O.") and not so_number.startswith("G.S.R."):
                so_number = re.sub(r"^SO", "S.O.", so_number, flags=re.IGNORECASE)

        # 2. Publishing Ministry & Department
        ministry = "Ministry of Consumer Affairs, Food and Public Distribution"
        department = None

        text_upper = text.upper()
        if "DEPARTMENT FOR PROMOTION OF INDUSTRY AND INTERNAL TRADE" in text_upper or "DPIIT" in text_upper:
            ministry = "Ministry of Commerce and Industry"
            department = "Department for Promotion of Industry and Internal Trade (DPIIT)"
        elif "MINISTRY OF COMMERCE AND INDUSTRY" in text_upper:
            ministry = "Ministry of Commerce and Industry"
        elif "MINISTRY OF STEEL" in text_upper:
            ministry = "Ministry of Steel"
        elif "MINISTRY OF POWER" in text_upper:
            ministry = "Ministry of Power"
        elif "MINISTRY OF CHEMICALS AND FERTILIZERS" in text_upper:
            ministry = "Ministry of Chemicals and Fertilizers"
        elif "MINISTRY OF HEAVY INDUSTRIES" in text_upper:
            ministry = "Ministry of Heavy Industries"
        elif "MINISTRY OF CONSUMER AFFAIRS" in text_upper:
            ministry = "Ministry of Consumer Affairs, Food and Public Distribution"
            department = "Department of Consumer Affairs"

        # 3. Order Title
        order_title = fallback_title
        title_patterns = [
            r"([A-Za-z0-9\s,\-\(\)]+\(Quality Control\)\s*Order,?\s*\d{4})",
            r"(Quality Control Order,?\s*\d{4}\s*for\s*[A-Za-z0-9\s,\-]+)",
            r"(THE GAZETTE OF INDIA\s*:\s*EXTRAORDINARY[\s\S]*?(?:ORDER|NOTIFICATION))",
        ]
        for pat in title_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                cand = m.group(1).strip()
                cand = re.sub(r"\s+", " ", cand)
                if len(cand) < 120 and "Quality Control" in cand:
                    order_title = cand
                    break

        # 4. Standards Covered
        found_standards = []
        for m in self.is_regex.finditer(text):
            std = m.group(1).strip()
            # Normalize whitespace
            std_norm = re.sub(r"\s+", " ", std).upper()
            if std_norm not in found_standards:
                found_standards.append(std_norm)

        # 5. Enforcement Date
        enforcement_date = "Enforced w.e.f. date of publication in Official Gazette"
        if "date of its publication in the Official Gazette" in text.lower():
            enforcement_date = "With immediate effect from date of Official Gazette publication"
        elif "six months from the date of publication" in text.lower():
            enforcement_date = "6 months from the date of Official Gazette publication"
        elif "one hundred and eighty days" in text.lower():
            enforcement_date = "180 days from the date of publication"
        else:
            dates = self.date_regex.findall(text)
            if dates:
                enforcement_date = f"Effective w.e.f. {dates[-1]}"

        # 6. Mandatory Status & Penal Provisions
        mandatory_status = "Strictly Mandatory (Section 29 BIS Act, 2016)"
        penal_provisions = "Section 29 BIS Act, 2016 (Sub-section 3: Imprisonment up to 2 years, or fine not less than ₹2,00,000 for first contravention, or both)"

        if "section 29" in text.lower():
            penal_provisions = (
                "Section 29 of the Bureau of Indian Standards Act, 2016 (11 of 2016): "
                "Any person who contravenes the provisions of this Order shall be punishable "
                "with imprisonment up to two years or fine not less than two lakh rupees or both."
            )

        # 7. Exemptions
        exemptions = []
        if "export" in text.lower():
            exemptions.append("Goods or articles manufactured domestically solely for export purposes")
        if "micro" in text.lower() or "small enterprises" in text.lower():
            exemptions.append("Extended compliance timeline for Micro and Small Enterprises as per MSME notification")

        return QCOMeta(
            so_number=so_number,
            ministry=ministry,
            department=department,
            order_title=order_title,
            enforcement_date=enforcement_date,
            mandatory_status=mandatory_status,
            penal_provisions=penal_provisions,
            standards_covered=found_standards,
            applicability_scope="All domestic manufacturers, importers, and sellers",
            exemptions=exemptions,
        )
