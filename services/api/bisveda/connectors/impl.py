import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from bisveda.config.settings import get_settings
from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.connectors.base import BaseConnector


class CatalogueConnector(BaseConnector):
    """
    BIS Indian Standards Catalogue Connector (Tier A Metadata).
    Source: https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "standards.json")
        super().__init__(
            source_id="catalogue",
            source_name="BIS Official Standards Catalogue",
            source_url="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/",
            knowledge_tier=KnowledgeTier.TIER_A,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        return self._records


class LaboratoryConnector(BaseConnector):
    """
    BIS-Recognized Testing Laboratories Connector (Tier B Directory).
    Source: https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/lab_directory/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "laboratories.json")
        super().__init__(
            source_id="laboratories",
            source_name="BIS Recognized Laboratories Directory",
            source_url="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/lab_directory/",
            knowledge_tier=KnowledgeTier.TIER_B,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        return self._records


class QCOConnector(BaseConnector):
    """
    Mandatory Quality Control Orders Connector (Tier B Gazette).
    Source: https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/qco/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "qcos.json")
        super().__init__(
            source_id="qcos",
            source_name="Gazette Quality Control Orders (DPIIT/MeitY/MoHFW)",
            source_url="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/qco/",
            knowledge_tier=KnowledgeTier.TIER_B,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        return self._records


class SchemeConnector(BaseConnector):
    """
    BIS Product Certification Schemes Connector (Tier B Statutory Schemes).
    Source: https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/conformity_assessment_schemes/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "schemes.json")
        super().__init__(
            source_id="schemes",
            source_name="BIS Conformity Assessment Schemes Regulations",
            source_url="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/conformity_assessment_schemes/",
            knowledge_tier=KnowledgeTier.TIER_B,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        return self._records


class UpdatesConnector(BaseConnector):
    """
    BIS What's New & Gazette Notifications Feed Connector.
    Source: https://www.bis.gov.in/whats-new/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "updates.json")
        super().__init__(
            source_id="whats_new",
            source_name="BIS Public Announcements & Gazette Notices",
            source_url="https://www.bis.gov.in/whats-new/",
            knowledge_tier=KnowledgeTier.TIER_B,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        else:
            # Seed foundational updates matching priority product categories
            self._records = [
                {
                    "id": "UPD-2026-001",
                    "title": "Mandatory QCO enforcement for Stainless Steel Cookware & Utensils",
                    "category": "QCO",
                    "ministry": "Ministry of Commerce and Industry (DPIIT)",
                    "effective_date": "2024-03-01",
                    "gazette_so": "S.O. 1245(E)",
                    "standards_impacted": ["IS 2347", "IS 17475"],
                    "summary": "Mandates ISI mark for domestic stainless steel pressure cookers and vacuum insulated flasks under BIS Act Section 29 penal provisions.",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/qco/",
                },
                {
                    "id": "UPD-2026-002",
                    "title": "80% Marking and Application Fee Concession for MSMEs & Startups",
                    "category": "Concession",
                    "ministry": "Ministry of Consumer Affairs, Food & Public Distribution",
                    "effective_date": "2023-01-01",
                    "standards_impacted": ["All Scheme-I Standards"],
                    "summary": "Special statutory fee relief: Micro, Small enterprises and DPIIT-recognized Startups pay only 20% of standard application and license renewal fees.",
                    "official_url": "https://www.manakonline.in",
                },
                {
                    "id": "UPD-2026-003",
                    "title": "Hallmarking of Gold Jewellery 6-digit HUID Mandate Extension to 350 Districts",
                    "category": "Hallmarking",
                    "ministry": "Bureau of Indian Standards",
                    "effective_date": "2024-06-01",
                    "standards_impacted": ["IS 1417", "IS 15820"],
                    "summary": "Mandatory hallmarking with unique alphanumeric HUID extended to phase-3 districts across India.",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/hallmarking/",
                },
            ]
        return self._records


class FAQConnector(BaseConnector):
    """
    BIS Official Verbatim FAQs Connector (Tier B Official Guidance).
    Source: https://www.bis.gov.in/faq/
    """

    def __init__(self, seed_path: Optional[Path] = None):
        settings = get_settings()
        path = seed_path or (settings.data_dir / "seed" / "faqs.json")
        super().__init__(
            source_id="faqs",
            source_name="BIS Official FAQs & Public Guidance",
            source_url="https://www.bis.gov.in/faq/",
            knowledge_tier=KnowledgeTier.TIER_B,
            seed_path=path,
        )

    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        if self.seed_path and self.seed_path.exists():
            with open(self.seed_path, "r", encoding="utf-8") as f:
                self._records = json.load(f)
        else:
            self._records = [
                {
                    "id": "FAQ-001",
                    "question": "What is Scheme-I of BIS?",
                    "answer": "Scheme-I (Product Certification Scheme) is the traditional conformity assessment scheme of BIS where manufacturing units with requisite in-house testing facilities are granted a licence to use the Standard Mark (ISI Mark).",
                    "category": "certification",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/faqs/",
                },
                {
                    "id": "FAQ-002",
                    "question": "What is the fee concession for MSME manufacturers?",
                    "answer": "Micro and Small enterprises, as well as DPIIT-registered Startups with a valid Udyam registration certificate, are entitled to an 80% concession on the application fee, annual license fee, and minimum marking fees under Product Certification Scheme-I.",
                    "category": "msme",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/faqs/",
                },
                {
                    "id": "FAQ-003",
                    "question": "What is the penalty for selling products without mandatory ISI mark under QCO?",
                    "answer": "Under Section 29 of the BIS Act, 2016, manufacturing, storing, or selling any product covered under a mandatory Quality Control Order (QCO) without the BIS Standard Mark is punishable with imprisonment up to two years, or with a fine not less than two lakh rupees, extending up to ten times the value of goods.",
                    "category": "qco",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/faqs/",
                },
                {
                    "id": "FAQ-004",
                    "question": "How to verify a 6-digit HUID on gold jewellery?",
                    "answer": "Every hallmarked gold article bears a unique 6-digit alphanumeric Hallmark Unique Identification (HUID) code. Consumers can verify the authenticity, jeweller registration, and assaying centre using the 'Verify HUID' feature in the official BIS Care mobile app.",
                    "category": "hallmarking",
                    "official_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/faqs/",
                },
            ]
        return self._records
