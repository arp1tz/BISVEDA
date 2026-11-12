"""
Full JSON PDF parser for BISVEDA ingestion

Usage: python parse_pdf_json.py <input_pdf> <output_json> [--enhanced]

--enhanced (used by the ingestion worker, R2.3) adds column-aware reading order for
two-column pages, OCR for pages whose text looks garbled, and per-page quality fields.
kb:build calls it without the flag so the current knowledge base stays reproducible.
"""
import sys
import json
import os
from parse_pdf import extract_pdf_data

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    enhanced = "--enhanced" in sys.argv[1:]
    if len(args) < 2:
        print("Usage: python parse_pdf_json.py <input_pdf> <output_json> [--enhanced]")
        sys.exit(1)

    input_pdf = args[0]
    output_json = args[1]

    try:
        data = extract_pdf_data(input_pdf, enhanced=enhanced)
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}", file=sys.stderr)
        sys.exit(1)
