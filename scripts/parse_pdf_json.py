"""
Full JSON PDF parser for BISVEDA ingestion
"""
import sys
import json
import os
from parse_pdf import extract_pdf_data

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python parse_pdf_json.py <input_pdf> <output_json>")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_json = sys.argv[2]

    try:
        data = extract_pdf_data(input_pdf)
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
