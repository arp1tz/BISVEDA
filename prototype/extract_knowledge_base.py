import fitz
import json
import os
import re

pdf_files = [
    {
        "file": "prototype/bis pdfs/PM_IS_4151_-Dec-24.pdf",
        "doc_id": "BIS-PM-4151-DEC2024",
        "title": "Product Manual for Protective Helmets for Two Wheeler Riders (IS 4151:2015/2020)",
        "edition": "PM/ IS 4151/ 3/ Dec 2024",
        "standard_number": "IS 4151"
    },
    {
        "file": "prototype/bis pdfs/IS-4151-Product-Manual.pdf",
        "doc_id": "BIS-PM-4151-JAN2019",
        "title": "Product Manual for Protective Helmet for Two Wheeler Riders According to IS 4151: 2015",
        "edition": "PM/ IS 4151/ 1/ January 2019",
        "standard_number": "IS 4151"
    }
]

chunks = []

for pdf_info in pdf_files:
    path = pdf_info["file"]
    if not os.path.exists(path):
        continue
    doc = fitz.open(path)
    for p_no in range(len(doc)):
        page = doc[p_no]
        raw_text = page.get_text()
        clean_text = re.sub(r'\s+', ' ', raw_text).strip()
        
        # Determine section topic based on page text
        section = "General Specification & Scope"
        if "ANNEX A" in raw_text or "List of Test Equipment" in raw_text:
            section = "Annex A: List of Required In-House Test Equipment"
        elif "ANNEX B" in raw_text or "SCHEME OF INSPECTION" in raw_text:
            section = "Annex B: Scheme of Inspection and Testing (SIT)"
        elif "TABLE 1" in raw_text or "Levels of Control" in raw_text:
            section = "Table 1: Levels of Control & Testing Frequency"
        elif "Sample quantity" in raw_text or "नमूने का पररमाण" in raw_text:
            section = "Licensing Sampling Guidelines & Sample Quantity"
            
        chunks.append({
            "chunk_id": f"{pdf_info['doc_id']}-P{p_no+1}",
            "doc_id": pdf_info["doc_id"],
            "doc_title": pdf_info["title"],
            "edition": pdf_info["edition"],
            "standard_number": pdf_info["standard_number"],
            "page_number": p_no + 1,
            "section": section,
            "char_count": len(clean_text),
            "text": clean_text
        })

output_path = "prototype/data/knowledge_base.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump({
        "total_chunks": len(chunks),
        "source_documents": [p["doc_id"] for p in pdf_files],
        "chunks": chunks
    }, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(chunks)} knowledge chunks and saved to {output_path}")
