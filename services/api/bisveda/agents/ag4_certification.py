from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent


class CertificationLicensingAgent(BaseSpecialistAgent):
    """
    AG4: Certification & Licensing Specialist Agent (Canonical Spec §3.3).
    Determines BIS Certification Scheme (Scheme-I, Scheme-II, Scheme-IV FMCS),
    calculates fee breakdowns with 80% MSME concessions, and produces compliance roadmaps.
    """

    agent_id = "AG4"
    agent_name = "Certification & Licensing Specialist"
    description = "Determines certification routes, MSME fee concessions, and factory audit roadmaps."

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        primary_cand = context.get("primary_standard") or {}
        user_type = str(context.get("user_type") or "msme").lower()
        std_scheme = primary_cand.get("scheme") or "Scheme-I (ISI)"
        std_num = primary_cand.get("standard_number") or primary_cand.get("is_number") or "IS Unknown"

        # Scheme determination
        scheme_code = "Scheme-I"
        scheme_name = "Scheme-I (Product Certification / ISI Mark)"
        if "scheme-ii" in std_scheme.lower() or "crs" in std_scheme.lower():
            scheme_code = "Scheme-II"
            scheme_name = "Scheme-II (Compulsory Registration Scheme / CRS)"
        elif "foreign" in std_scheme.lower() or "fmcs" in std_scheme.lower():
            scheme_code = "Scheme-IV"
            scheme_name = "Scheme-IV (Foreign Manufacturers Certification Scheme / FMCS)"

        # Fee calculation with 80% MSME / Startup Concession (BIS Official Fee Structure)
        is_msme = user_type in ("msme", "micro", "small", "startup")
        base_app_fee = 5000
        base_annual_fee = 1000
        audit_daily_fee = 7000
        est_lab_test_fee = 12000

        if is_msme:
            app_fee = int(base_app_fee * 0.20)  # 80% concession -> Rs 1,000
            concession_note = "80% concession applied under DPIIT MSME / Startup initiative."
        else:
            app_fee = base_app_fee
            concession_note = "Standard non-MSME enterprise tariff."

        total_est_initial = app_fee + base_annual_fee + audit_daily_fee + est_lab_test_fee

        steps = [
            {
                "step_number": 1,
                "title": "STI Lab Setup & Calibration",
                "description": "Establish in-house testing equipment complying with the BIS Scheme of Testing and Inspection (STI).",
            },
            {
                "step_number": 2,
                "title": "Online Portal Application (Manakonline)",
                "description": f"Submit Form V on manakonline.in with manufacturing layout, equipment list, and proof of {user_type.upper()} registration.",
            },
            {
                "step_number": 3,
                "title": "BIS Factory Audit",
                "description": "BIS Technical Officer conducts verification of manufacturing process, quality personnel, and in-house testing.",
            },
            {
                "step_number": 4,
                "title": "Independent Sample Testing",
                "description": f"Officer draws random product samples for testing at an accredited laboratory for {std_num} compliance.",
            },
            {
                "step_number": 5,
                "title": "Grant of License (CM/L)",
                "description": "Upon successful audit and passing test report, BIS issues CM/L license number with authorization to affix the ISI Mark.",
            },
        ]

        return {
            "scheme_code": scheme_code,
            "scheme_name": scheme_name,
            "user_type": user_type,
            "msme_concession_applied": is_msme,
            "concession_percentage": 80 if is_msme else 0,
            "concession_note": concession_note,
            "fee_breakdown": {
                "application_fee": app_fee,
                "standard_app_fee": base_app_fee,
                "annual_license_fee": base_annual_fee,
                "factory_inspection_fee": audit_daily_fee,
                "estimated_lab_testing_fee": est_lab_test_fee,
                "total_estimated_initial_cost": total_est_initial,
                "currency": "INR",
            },
            "timeline_estimate": "30 to 60 days (fast-track simplified procedure for MSMEs)",
            "roadmap_steps": steps,
        }
