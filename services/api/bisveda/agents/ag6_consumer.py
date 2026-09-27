import re
from typing import Any, Dict, Optional
from bisveda.agents.base import BaseSpecialistAgent


class ConsumerAssistanceAgent(BaseSpecialistAgent):
    """
    AG6: Consumer Assistance Specialist Agent (Canonical Spec §3.3).
    Performs regex shape validation on CM/L (7-8 digits), CRS (5-8 digits),
    and HUID (6 alphanumeric chars), providing direct links to the official BIS verification portals.
    """

    agent_id = "AG6"
    agent_name = "Consumer Assistance Specialist"
    description = "Validates BIS marks (CM/L, CRS, HUID) and routes to official verification."

    CML_REGEX = re.compile(r"^\d{7,8}$")
    CRS_REGEX = re.compile(r"^\d{5,8}$")
    HUID_REGEX = re.compile(r"^[A-Z0-9]{6}$", re.IGNORECASE)

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        mark_type = str(context.get("mark_type") or "cml").lower()
        identifier = str(context.get("identifier") or "").strip().upper()

        if "cml" in mark_type or re.match(r"^CM/?L", identifier, re.IGNORECASE):
            clean_id = re.sub(r"[^\d]", "", identifier)
            is_valid_shape = bool(self.CML_REGEX.match(clean_id))
            return {
                "identifier": clean_id or identifier,
                "mark_type": "CM/L (ISI Certification License)",
                "is_valid_format": is_valid_shape,
                "expected_format": "7 or 8 digits (e.g., 8765432)",
                "verification_status": "VALID_FORMAT_PENDING_PORTAL" if is_valid_shape else "INVALID_FORMAT",
                "official_portal_url": f"https://www.manakonline.in/MANAK/Search_CML?cmlNo={clean_id}",
                "guidance": (
                    f"Format validated for CM/L {clean_id}. Check live licensee details and validity on Manakonline or BIS Care app."
                    if is_valid_shape
                    else "CM/L numbers must be exactly 7 or 8 numeric digits found below the ISI mark."
                ),
            }

        elif "huid" in mark_type or "hallmark" in mark_type:
            is_valid_shape = bool(self.HUID_REGEX.match(identifier))
            return {
                "identifier": identifier,
                "mark_type": "HUID (Hallmarking Unique ID)",
                "is_valid_format": is_valid_shape,
                "expected_format": "6 alphanumeric uppercase characters (e.g., A1B2C3)",
                "verification_status": "VALID_FORMAT_PENDING_PORTAL" if is_valid_shape else "INVALID_FORMAT",
                "official_portal_url": "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/",
                "guidance": (
                    f"Format valid for HUID {identifier}. Verify gold purity, jeweller registration, and AHC on BIS Care app."
                    if is_valid_shape
                    else "HUID must be a 6-character alphanumeric code laser-engraved alongside the BIS hallmark."
                ),
            }

        elif "crs" in mark_type or "registration" in mark_type:
            clean_id = re.sub(r"[^\d]", "", identifier)
            is_valid_shape = bool(self.CRS_REGEX.match(clean_id))
            return {
                "identifier": clean_id or identifier,
                "mark_type": "CRS (Compulsory Registration Scheme for Electronics)",
                "is_valid_format": is_valid_shape,
                "expected_format": "5 to 8 digits (e.g., 41001234)",
                "verification_status": "VALID_FORMAT_PENDING_PORTAL" if is_valid_shape else "INVALID_FORMAT",
                "official_portal_url": "https://www.crsbis.in/BIS/appsearch.do",
                "guidance": (
                    f"Format valid for CRS R-{clean_id}. Verify manufacturer and brand on the CRS portal."
                    if is_valid_shape
                    else "CRS registration numbers (prefixed with R-) typically consist of 5 to 8 numeric digits."
                ),
            }

        return {
            "identifier": identifier,
            "mark_type": "UNKNOWN",
            "is_valid_format": False,
            "expected_format": "Specify CM/L (7-8 digits), HUID (6 alphanumeric), or CRS (5-8 digits).",
            "verification_status": "UNKNOWN_MARK_TYPE",
            "official_portal_url": "https://www.services.bis.gov.in/",
            "guidance": "Please specify the mark type to verify: ISI Mark (CM/L), Gold Hallmarking (HUID), or Electronics (CRS).",
        }
