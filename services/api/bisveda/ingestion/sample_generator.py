import io
from typing import Dict, Optional
import fitz  # PyMuPDF


def generate_sample_pdf(sample_type: str = "cookers_qco") -> bytes:
    """
    Generates authentic vector PDF documents for testing and UI demonstration
    using PyMuPDF. Creates realistic Gazette QCOs, Technical Standards, or User Tenders.
    """
    doc = fitz.open()

    if sample_type in ("cookers_qco", "qco"):
        # Page 1: Gazette Notification Header & Clauses
        page = doc.new_page()
        text = (
            "THE GAZETTE OF INDIA : EXTRAORDINARY\n"
            "PART II—Section 3—Sub-section (ii)\n"
            "PUBLISHED BY AUTHORITY\n\n"
            "MINISTRY OF COMMERCE AND INDUSTRY\n"
            "(Department for Promotion of Industry and Internal Trade)\n"
            "ORDER\n"
            "New Delhi, the 15th October, 2024\n\n"
            "S.O. 4321(E).—In exercise of the powers conferred by section 16 of the Bureau of Indian Standards Act, 2016 "
            "(11 of 2016), the Central Government, after consulting the Bureau of Indian Standards, hereby makes the following Order:\n\n"
            "1. Short title, commencement and application.—(1) This Order may be called the Domestic Pressure Cooker "
            "(Quality Control) Order, 2024.\n"
            "(2) It shall come into force with immediate effect from the date of its publication in the Official Gazette.\n"
            "(3) It shall apply to all domestic pressure cookers manufactured or imported into India.\n\n"
            "2. Compulsory use of Standard Mark.—Goods or articles specified in column (1) of the Table shall conform to the "
            "corresponding Indian Standard IS 2347:2017 and shall bear the Standard Mark under a licence from the Bureau as per Scheme-I "
            "of Schedule-II of the Bureau of Indian Standards (Conformity Assessment) Regulations, 2018.\n\n"
            "3. Certification and Enforcement Authority.—The Bureau of Indian Standards shall be the certifying and enforcing authority "
            "for goods or articles specified in the Table.\n\n"
            "4. Penal provisions for contravention.—Any person who contravenes the provisions of this Order shall be punishable under "
            "Section 29 of the Bureau of Indian Standards Act, 2016 (11 of 2016) with imprisonment up to two years or fine not less than "
            "two lakh rupees or both.\n\n"
            "SCHEDULE TABLE\n"
        )
        page.insert_text((50, 50), text, fontsize=9.5)

        # Draw a table with lines
        rect = fitz.Rect(50, 480, 540, 560)
        page.draw_rect(rect)
        page.draw_line((50, 510), (540, 510))
        page.draw_line((180, 480), (180, 560))
        page.draw_line((300, 480), (300, 560))

        page.insert_text((60, 500), "Goods or Article", fontsize=9)
        page.insert_text((190, 500), "Indian Standard", fontsize=9)
        page.insert_text((310, 500), "Title of Indian Standard", fontsize=9)

        page.insert_text((60, 535), "Domestic Pressure Cooker", fontsize=9)
        page.insert_text((190, 535), "IS 2347:2017", fontsize=9)
        page.insert_text((310, 535), "Domestic Pressure Cookers — Specification", fontsize=9)

    elif sample_type in ("flasks_standard", "standard"):
        # Page 1: Standard Title & Scope
        page = doc.new_page()
        text = (
            "IS 17526 : 2021\n"
            "(Reaffirmed 2024)\n\n"
            "Indian Standard\n"
            "STAINLESS STEEL VACUUM FLASKS AND INSULATED BOTTLES — SPECIFICATION\n"
            "Sectional Committee: MED 32 (Domestic Utensils and Appliances)\n\n"
            "FOREWORD\n"
            "This Indian Standard was adopted by the Bureau of Indian Standards after the draft finalized by the "
            "Domestic Utensils Sectional Committee had been approved by the Mechanical Engineering Division Council.\n\n"
            "1 Scope\n"
            "1.1 This standard specifies material, constructional, and safety requirements for stainless steel vacuum flasks "
            "and insulated drinkware for household and domestic use.\n\n"
            "2 Normative References\n"
            "The following standards contain provisions which constitute provisions of this standard: IS 6911 (Stainless steel plate), "
            "IS 10146 (Polyethylene for food contact).\n\n"
            "3 Terminology\n"
            "3.1 Vacuum Flask — A double-walled vessel with evacuated space between walls to reduce heat transfer.\n\n"
            "4 Technical Requirements\n"
            "4.1 Material Requirements: Body and inner vessel shall be made from Austenitic Stainless Steel Grade 304 conforming to IS 6911.\n"
            "4.2 Nominal Capacity: Flasks shall have capacities ranging from 250 ml to 2000 ml.\n"
            "4.3 Thermal Performance: Liquid temperature shall remain above 60°C after 6 hours when filled initially at 95°C.\n\n"
            "5 Sampling\n"
            "5.1 The scale of sampling and criteria for conformity shall be as given in Annex A.\n\n"
            "6 Performance Tests\n"
            "6.1 Impact Resistance Test: Flask shall withstand a drop from 1.2 m height onto concrete without leak or loss of vacuum.\n"
            "6.2 Thermal Shock Test: Vessel shall be subjected to alternate cycles of 100°C water and 4°C water.\n\n"
            "7 Marking and Labelling\n"
            "7.1 Each flask shall be indelibly marked with the manufacturer's name, brand, capacity, and the BIS Standard Mark.\n"
        )
        page.insert_text((50, 50), text, fontsize=9.5)

    elif sample_type in ("user_tender", "user_upload"):
        page = doc.new_page()
        text = (
            "PUBLIC WORKS DEPARTMENT (PWD) — WATER SUPPLY DIVISION\n"
            "NOTICE INVITING TENDER (NIT No. PWD/WSD/2026/089)\n\n"
            "Project: Supply and Laying of Transmission Water Mains in Sector 14.\n\n"
            "1. Technical Specifications:\n"
            "1.1 All mild steel and stainless steel tubes supplied shall strictly comply with Indian Standard IS 1239 (Part 1 and Part 2).\n"
            "1.2 Welded steel pipes for water pipelines of diameter > 200 mm shall strictly conform to IS 3589:2001.\n"
            "1.3 All valves and fittings shall bear valid BIS ISI certification marks.\n\n"
            "2. Testing Requirements:\n"
            "Contractor must produce third-party test certificates from BIS-recognized or NABL-accredited test laboratories prior to dispatch.\n"
        )
        page.insert_text((50, 50), text, fontsize=9.5)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes
