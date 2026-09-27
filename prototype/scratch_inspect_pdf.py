import fitz
import json

doc = fitz.open(r'prototype/bis pdfs/PM_IS_4151_-Dec-24.pdf')
pages_data = []

for idx, page in enumerate(doc):
    txt = page.get_text()
    lines = [line.strip() for line in txt.split('\n') if line.strip()]
    pages_data.append({
        "page": idx + 1,
        "first_lines": lines[:4],
        "char_count": len(txt)
    })

print(f"Total pages: {len(pages_data)}")
for p in pages_data:
    print(f"Page {p['page']} ({p['char_count']} chars): {' // '.join(p['first_lines'])}")
