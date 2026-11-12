"""
BISVEDA Sovereign Document Parsing Engine
L2 Ingestion & Document Intelligence (§7.1-§7.3)

Capabilities:
- Digital PDF layout & table extraction (PyMuPDF)
- Scanned PDF & Corrupted Font OCR (RapidOCR onnxruntime)
- DOCX parsing (OpenXML paragraphs & tables)
- TXT, CSV, Markdown parsing
- Table structure preservation (Markdown tables + structured 2D matrix)
- Heading & Clause hierarchy detection (1, 1.1, 1.1.1, Annex A, Table N, Figure N)
- Repetitive Header & Footer removal across pages
- Multi-column reading order preservation
- Technical formula & symbol preservation
- Full page provenance tracking
"""

import sys
import json
import re
import os
import io
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

try:
    import fitz  # PyMuPDF
except ImportError:
    print("[-] PyMuPDF is not installed. Run: pip install pymupdf", file=sys.stderr)
    fitz = None

_rapid_ocr_instance = None

def get_ocr():
    global _rapid_ocr_instance
    if _rapid_ocr_instance is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _rapid_ocr_instance = RapidOCR()
        except Exception as e:
            _rapid_ocr_instance = False
    return _rapid_ocr_instance if _rapid_ocr_instance is not False else None


# ─── Enhanced mode (R2.3): text-quality check and column-aware reading order ──
# Used only by the ingestion worker (parse_pdf_json.py --enhanced). kb:build keeps
# the original behaviour so the current knowledge base stays reproducible (TD-14).

_COMMON_WORDS = set("""
the of and to in a for be shall is as by with on or that at from are which not this an it when than per
each all may should test tested standard specimen sample its under after before between any other such
been have has used use specified given accordance method clause table figure part see also no into where
""".split())


def common_word_ratio(text):
    """Share of Latin words that are common English function words. Normal text: ~0.25-0.45.
    Text from a broken font mapping is letters in the wrong order, so the ratio collapses to ~0.
    Returns None when there are too few Latin words to judge (e.g. a Hindi page)."""
    words = re.findall(r"[A-Za-z]{2,}", text)
    if len(words) < 30:
        return None
    common = sum(1 for w in words if w.lower() in _COMMON_WORDS)
    return common / len(words)


_CLAUSE_NUM_RE = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2}){1,4})\s+[A-Z]", re.M)


def clause_inversions(text):
    """How often a clause number is lower than the one before it (0 = numbers read in order)."""
    nums = [tuple(int(x) for x in m.group(1).split(".")) for m in _CLAUSE_NUM_RE.finditer(text)]
    return sum(1 for a, b in zip(nums, nums[1:]) if b < a)


def column_ordered_text(page):
    """Returns (text, is_two_column) for the page's native text blocks. See order_blocks_by_column."""
    try:
        blocks = [b for b in page.get_text("blocks") if len(b) >= 7 and b[6] == 0 and b[4].strip()]
    except Exception:
        return None, False
    return order_blocks_by_column(blocks, page.rect.width)


def order_blocks_by_column(blocks, width):
    """blocks: (x0, y0, x1, y1, text, ...). On a clear two-column layout, reads the left column then
    the right column between full-width blocks. Returns (text, is_two_column)."""
    if len(blocks) < 6:
        return None, False
    left = [b for b in blocks if b[2] <= width * 0.52]
    right = [b for b in blocks if b[0] >= width * 0.48]
    span = [b for b in blocks if b not in left and b not in right]
    chars = lambda bs: sum(len(b[4]) for b in bs)
    total = max(chars(blocks), 1)
    two_col = (
        len(left) >= 3 and len(right) >= 3
        and chars(left) > 0.2 * total and chars(right) > 0.2 * total
        and chars(left) + chars(right) > 0.6 * total
    )
    if not two_col:
        return None, False
    out = []
    pending_left = sorted(left, key=lambda b: (b[1], b[0]))
    pending_right = sorted(right, key=lambda b: (b[1], b[0]))
    for s in sorted(span, key=lambda b: b[1]):
        out += [b[4] for b in pending_left if b[1] < s[1]]
        out += [b[4] for b in pending_right if b[1] < s[1]]
        pending_left = [b for b in pending_left if b[1] >= s[1]]
        pending_right = [b for b in pending_right if b[1] >= s[1]]
        out.append(s[4])
    out += [b[4] for b in pending_left] + [b[4] for b in pending_right]
    return "\n".join(t.rstrip("\n") for t in out) + "\n", True


# ─── Formatting & Table Helpers ──────────────────────────────────────────────

def format_table_as_markdown(headers, rows):
    """Formats 2D table grid into standard Markdown table."""
    if not headers and not rows:
        return ""
    all_rows = []
    if headers:
        all_rows.append([str(c or "").replace("\n", " ").strip() for c in headers])
    for r in rows:
        all_rows.append([str(c or "").replace("\n", " ").strip() for c in r])

    if not all_rows:
        return ""

    num_cols = max(len(r) for r in all_rows)
    padded = [r + [""] * (num_cols - len(r)) for r in all_rows]

    header_row = padded[0]
    sep_row = ["---"] * num_cols
    body_rows = padded[1:]

    lines = []
    lines.append("| " + " | ".join(header_row) + " |")
    lines.append("| " + " | ".join(sep_row) + " |")
    for row in body_rows:
        lines.append("| " + " | ".join(row) + " |")

    return "\n".join(lines)


# ─── Header / Footer Filter ──────────────────────────────────────────────────

def remove_repetitive_headers_footers(pages_text_list):
    """
    Identifies recurring header and footer lines that appear across > 30% of pages
    at the start or end of a page and strips them from the body text.
    """
    if len(pages_text_list) <= 2:
        return pages_text_list

    top_candidates = Counter()
    bottom_candidates = Counter()

    for text in pages_text_list:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if len(lines) >= 3:
            for l in lines[:3]:
                if len(l) < 120 and not re.match(r"^\d+(\.\d+)*\s+[A-Z]", l):
                    top_candidates[l] += 1
            for l in lines[-3:]:
                if len(l) < 80:
                    bottom_candidates[l] += 1

    threshold = max(2, len(pages_text_list) * 0.3)
    repetitive_headers = {l for l, c in top_candidates.items() if c >= threshold}
    repetitive_footers = {l for l, c in bottom_candidates.items() if c >= threshold}

    repetitive_headers.update({
        "BUREAU OF INDIAN STANDARDS",
        "MANAK BHAVAN, 9 BAHADUR SHAH ZAFAR MARG",
        "NEW DELHI 110002",
        "NEW DELHI-110002",
        "INDIAN STANDARD",
    })

    cleaned_pages = []
    for text in pages_text_list:
        lines = text.splitlines()
        cleaned_lines = []
        for l in lines:
            s = l.strip()
            if s in repetitive_headers or s in repetitive_footers:
                continue
            if re.match(r"^\d{1,4}$", s) and len(cleaned_lines) < 2:
                continue
            cleaned_lines.append(l)
        cleaned_pages.append("\n".join(cleaned_lines))

    return cleaned_pages


# ─── Clause & Heading Detector ───────────────────────────────────────────────

CLAUSE_PATTERNS = [
    re.compile(r"^(\d+(?:\.\d+)*)\s+(.+)$"),
    re.compile(r"^(?:CLAUSE|SECTION)\s+(\d+(?:\.\d+)*)\s*[-:]?\s*(.*)$", re.IGNORECASE),
    re.compile(r"^(ANNEX\s+[A-Z](?:\s*\([^)]+\))?)\s*[-:]?\s*(.*)$", re.IGNORECASE),
    re.compile(r"^(Table\s+\d+(?:\s*\([^)]+\))?)\s*[-:]?\s*(.*)$", re.IGNORECASE),
    re.compile(r"^(Figure\s+\d+(?:\s*\([^)]+\))?)\s*[-:]?\s*(.*)$", re.IGNORECASE),
]

def extract_headings(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    headings = []
    for line in lines:
        for pat in CLAUSE_PATTERNS:
            m = pat.match(line)
            if m:
                headings.append(line[:100])
                break
        else:
            if re.match(r"^[A-Z\s]{4,60}$", line) and len(line) < 60:
                headings.append(line)
    return headings[:15]


# ─── Multi-Format Handlers ───────────────────────────────────────────────────

def extract_docx_data(file_path_or_bytes):
    try:
        if isinstance(file_path_or_bytes, bytes):
            file_obj = io.BytesIO(file_path_or_bytes)
        else:
            file_obj = file_path_or_bytes

        with zipfile.ZipFile(file_obj) as z:
            xml_content = z.read("word/document.xml")
            root = ET.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            paragraphs = []
            tables = []

            for tbl in root.findall(".//w:tbl", ns):
                table_rows = []
                for tr in tbl.findall(".//w:tr", ns):
                    row_cells = []
                    for tc in tr.findall(".//w:tc", ns):
                        cell_text = "".join([node.text for node in tc.findall(".//w:t", ns) if node.text])
                        row_cells.append(cell_text.strip())
                    if row_cells:
                        table_rows.append(row_cells)
                if table_rows:
                    md_table = format_table_as_markdown(table_rows[0], table_rows[1:])
                    tables.append(table_rows)
                    paragraphs.append("\n" + md_table + "\n")

            for p in root.findall(".//w:p", ns):
                texts = [node.text for node in p.findall(".//w:t", ns) if node.text]
                if texts:
                    paragraphs.append("".join(texts))

            full_text = "\n".join(paragraphs)
            pages = []
            page_size = 2500
            for idx, pos in enumerate(range(0, max(len(full_text), 1), page_size)):
                page_text = full_text[pos:pos+page_size]
                headings = extract_headings(page_text)
                pages.append({
                    "pageNumber": idx + 1,
                    "text": page_text,
                    "charCount": len(page_text),
                    "headings": headings,
                    "tables": tables[:2] if idx == 0 else [],
                    "isOcr": False
                })

            std_match = re.search(r"\bIS\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?:\s*:\s*\d{4})?)", full_text, re.I)
            detected_standard = re.sub(r"\s+", " ", std_match.group(0)).strip() if std_match else None

            title_match = re.search(r"(?:SPECIFICATION|STANDARD|CODE OF PRACTICE|GUIDELINES?|SAFETY OF|REQUIREMENTS FOR)\s*(?:FOR|ON)?\s*([^\n\r]{10,120})", full_text, re.I)
            detected_title = title_match.group(0).strip()[:120] if title_match else None

            return {
                "totalPages": len(pages),
                "totalChars": len(full_text),
                "detectedStandardNumber": detected_standard,
                "detectedTitle": detected_title,
                "isOcrDoc": False,
                "meanOcrQuality": 1.0,
                "pages": pages
            }
    except Exception as e:
        return None


def extract_image_data(img_path_or_bytes):
    """Direct OCR on an image file using RapidOCR."""
    ocr = get_ocr()
    if not ocr:
        raise RuntimeError("RapidOCR is not available for image document processing")

    if isinstance(img_path_or_bytes, bytes):
        img_bytes = img_path_or_bytes
    else:
        with open(img_path_or_bytes, "rb") as f:
            img_bytes = f.read()

    result, elapse = ocr(img_bytes)
    if result:
        extracted_lines = [line[1] for line in result]
        full_text = "\n".join(extracted_lines)
        confidences = [float(line[2]) for line in result if len(line) > 2]
        mean_quality = sum(confidences) / len(confidences) if confidences else 0.85
    else:
        full_text = ""
        mean_quality = 0.0

    headings = extract_headings(full_text)
    std_match = re.search(r"\bIS\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?:\s*:\s*\d{4})?)", full_text, re.I)
    title_match = re.search(r"(?:SPECIFICATION|STANDARD|CODE OF PRACTICE|GUIDELINES?|SAFETY OF|REQUIREMENTS FOR)\s*(?:FOR|ON)?\s*([^\n\r]{10,120})", full_text, re.I)

    return {
        "totalPages": 1,
        "totalChars": len(full_text),
        "detectedStandardNumber": re.sub(r"\s+", " ", std_match.group(0)).strip() if std_match else None,
        "detectedTitle": title_match.group(0).strip()[:120] if title_match else None,
        "isOcrDoc": True,
        "meanOcrQuality": round(mean_quality, 2),
        "pages": [{
            "pageNumber": 1,
            "text": full_text,
            "charCount": len(full_text),
            "headings": headings,
            "tables": [],
            "isOcr": True,
            "ocrQuality": round(mean_quality, 2)
        }]
    }


def extract_pdf_data(pdf_path_or_bytes, enhanced=False):
    """
    High-fidelity PDF processing using PyMuPDF + RapidOCR.
    - Native digital text layout extraction
    - Automatic table extraction via page.find_tables()
    - Scanned/low-text/corrupted font page OCR fallback via RapidOCR
    - Repetitive header & footer detection
    """
    if isinstance(pdf_path_or_bytes, str):
        lower = pdf_path_or_bytes.lower()
        if lower.endswith(".docx"):
            res = extract_docx_data(pdf_path_or_bytes)
            if res: return res
        elif lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
            return extract_image_data(pdf_path_or_bytes)
    elif isinstance(pdf_path_or_bytes, bytes):
        if pdf_path_or_bytes.startswith(b"PK\x03\x04"):
            res = extract_docx_data(pdf_path_or_bytes)
            if res: return res
        elif pdf_path_or_bytes.startswith((b"\x89PNG", b"\xff\xd8\xff", b"RIFF")):
            return extract_image_data(pdf_path_or_bytes)

    import fitz  # PyMuPDF

    if isinstance(pdf_path_or_bytes, bytes):
        doc = fitz.open(stream=pdf_path_or_bytes, filetype="pdf")
    else:
        doc = fitz.open(pdf_path_or_bytes)

    pages = []
    raw_texts = []
    ocr_pages_count = 0
    ocr_quality_sum = 0.0
    ocr_engine = None

    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # 1. Native digital text extraction
        native_text = page.get_text("text") or ""
        page_layout = "single"
        if enhanced:
            ordered, is_two_col = column_ordered_text(page)
            if is_two_col and ordered:
                page_layout = "two_column"
                # Archive.org text layers are usually already in column order; switch only when the
                # column order reads clause numbers in order more often than the native order does.
                if clause_inversions(ordered) < clause_inversions(native_text):
                    native_text = ordered
                    page_layout = "two_column_reordered"
        page_tables = []
        md_tables = []

        # 2. Extract structured tables
        try:
            tabs = page.find_tables()
            if tabs and tabs.tables:
                for t in tabs.tables:
                    extracted = t.extract()
                    if extracted and len(extracted) >= 2:
                        page_tables.append(extracted)
                        md_t = format_table_as_markdown(extracted[0], extracted[1:])
                        if md_t:
                            md_tables.append(md_t)
        except Exception:
            pass

        # 3. Check if page is scanned OR has corrupted fonts (low alphanumeric ratio)
        alnum_count = len(re.findall(r"[a-zA-Z0-9\u0900-\u097F]", native_text))
        alnum_ratio = alnum_count / max(len(native_text), 1)
        is_scanned_or_corrupted = (len(native_text.strip()) < 60) or (len(native_text.strip()) > 100 and alnum_ratio < 0.35)
        word_ratio = common_word_ratio(native_text) if enhanced else None
        ocr_reason = None
        if len(native_text.strip()) < 60:
            ocr_reason = "little_text"
        elif is_scanned_or_corrupted:
            ocr_reason = "low_alnum"
        elif enhanced and len(native_text.strip()) > 200 and word_ratio is not None and word_ratio < 0.05:
            ocr_reason = "garbled_words"
            is_scanned_or_corrupted = True

        final_page_text = native_text
        page_is_ocr = False
        page_ocr_quality = 1.0

        if is_scanned_or_corrupted:
            if ocr_engine is None:
                ocr_engine = get_ocr()
            if ocr_engine:
                try:
                    pix = page.get_pixmap(dpi=150)
                    res, _ = ocr_engine(pix.tobytes("png"))
                    if res:
                        ocr_lines = [l[1] for l in res]
                        ocr_text = "\n".join(ocr_lines)
                        if enhanced:
                            # Same column check on the OCR line boxes (RapidOCR reads across both columns).
                            boxes = []
                            for l in res:
                                xs = [pt[0] for pt in l[0]]
                                ys = [pt[1] for pt in l[0]]
                                boxes.append((min(xs), min(ys), max(xs), max(ys), l[1] + "\n"))
                            ordered_ocr, ocr_two_col = order_blocks_by_column(boxes, pix.width)
                            if ocr_two_col and ordered_ocr:
                                page_layout = "two_column"
                                if clause_inversions(ordered_ocr) < clause_inversions(ocr_text):
                                    ocr_text = ordered_ocr
                                    page_layout = "two_column_reordered"
                        if len(ocr_text.strip()) > 30:
                            final_page_text = ocr_text
                            confidences = [float(l[2]) for l in res if len(l) > 2]
                            page_ocr_quality = sum(confidences) / len(confidences) if confidences else 0.85
                            page_is_ocr = True
                            ocr_pages_count += 1
                            ocr_quality_sum += page_ocr_quality
                except Exception as ocr_err:
                    pass

        # Append formatted tables into page text if not already embedded
        if md_tables:
            final_page_text += "\n\n### Extracted Tables:\n" + "\n\n".join(md_tables)

        headings = extract_headings(final_page_text)

        page_record = {
            "pageNumber": page_num + 1,
            "text": final_page_text,
            "charCount": len(final_page_text),
            "headings": headings,
            "tables": page_tables,
            "isOcr": page_is_ocr,
            "ocrQuality": round(page_ocr_quality, 2)
        }
        if enhanced:
            page_record["layout"] = page_layout
            page_record["quality"] = {
                "alnumRatio": round(alnum_ratio, 3),
                "wordRatio": None if word_ratio is None else round(word_ratio, 3),
                "ocrReason": ocr_reason,
            }
        pages.append(page_record)
        raw_texts.append(final_page_text)

    # 4. Clean repetitive headers and footers across pages
    cleaned_texts = remove_repetitive_headers_footers(raw_texts)
    for idx, clean_t in enumerate(cleaned_texts):
        pages[idx]["text"] = clean_t
        pages[idx]["charCount"] = len(clean_t)

    all_text = "\n".join(cleaned_texts)
    total_chars = len(all_text)
    is_ocr_doc = ocr_pages_count > (len(pages) * 0.4)

    # 5. Extract Standard Number and Title (Check unstripped first pages first!)
    first_pages_raw = "\n".join(raw_texts[:2]) if raw_texts else ""
    std_match = re.search(
        r"\bIS\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?:\s*:\s*\d{4})?)",
        first_pages_raw,
        re.IGNORECASE
    )
    if not std_match:
        std_match = re.search(
            r"\bIS\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?:\s*:\s*\d{4})?)",
            all_text,
            re.IGNORECASE
        )
    detected_standard = re.sub(r"\s+", " ", std_match.group(0)).strip() if std_match else None

    # Title detection
    title_match = re.search(
        r"(?:Safety of Toys[^\n\r]{0,80}|(?:SPECIFICATION|STANDARD|CODE OF PRACTICE|GUIDELINES?|SAFETY OF|REQUIREMENTS FOR)\s*(?:FOR|ON)?\s*([^\n\r]{10,120}))",
        first_pages_raw,
        re.IGNORECASE
    )
    if not title_match:
        title_match = re.search(
            r"(?:SPECIFICATION|STANDARD|CODE OF PRACTICE|GUIDELINES?|SAFETY OF|REQUIREMENTS FOR)\s*(?:FOR|ON)?\s*([^\n\r]{10,120})",
            all_text,
            re.IGNORECASE
        )
    detected_title = title_match.group(0).strip()[:120] if title_match else None

    # Detect edition year
    edition_year = None
    if detected_standard:
        yr_m = re.search(r":\s*(\d{4})", detected_standard)
        if yr_m: edition_year = yr_m.group(1)
    if not edition_year:
        yr_m = re.search(r"\b(19\d\d|20[0-2]\d)\b", first_pages_raw[:2000])
        if yr_m: edition_year = yr_m.group(1)

    mean_ocr_quality = (ocr_quality_sum / ocr_pages_count) if ocr_pages_count > 0 else 1.0

    return {
        "totalPages": len(pages),
        "totalChars": total_chars,
        "detectedStandardNumber": detected_standard,
        "detectedTitle": detected_title,
        "editionYear": edition_year,
        "isOcrDoc": is_ocr_doc,
        "ocrPagesCount": ocr_pages_count,
        "meanOcrQuality": round(mean_ocr_quality, 2),
        "pages": pages
    }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        try:
            result = extract_pdf_data(file_path)
            summary = {
                "totalPages": result["totalPages"],
                "totalChars": result["totalChars"],
                "detectedStandardNumber": result["detectedStandardNumber"],
                "detectedTitle": result["detectedTitle"],
                "editionYear": result.get("editionYear"),
                "isOcrDoc": result["isOcrDoc"],
                "ocrPagesCount": result.get("ocrPagesCount", 0),
                "meanOcrQuality": result["meanOcrQuality"],
                "page1TextSample": result["pages"][0]["text"][:250].replace("\n", " ") if result["pages"] else "",
                "tablesCount": sum(len(p.get("tables", [])) for p in result["pages"])
            }
            print(json.dumps(summary, indent=2))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
