import io
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import uuid

import fitz  # PyMuPDF
from pydantic import BaseModel, Field


class ExtractedTable(BaseModel):
    page_number: int
    bbox: Tuple[float, float, float, float]
    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)
    markdown: str = ""


class ExtractedBlock(BaseModel):
    page_number: int
    bbox: Tuple[float, float, float, float]
    text: str
    font_size: float = 0.0
    is_heading: bool = False


class ExtractedPage(BaseModel):
    page_number: int
    text: str
    blocks: List[ExtractedBlock] = Field(default_factory=list)
    tables: List[ExtractedTable] = Field(default_factory=list)
    is_scanned: bool = False
    ocr_applied: bool = False
    ocr_quality: float = 1.0


class ParsedDocument(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    total_text_length: int
    pages: List[ExtractedPage] = Field(default_factory=list)
    raw_text: str = ""
    tables: List[ExtractedTable] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    detected_doc_type: str = "standard"  # qco, standard, circular, user_upload
    scanned_page_count: int = 0
    has_scanned_pages: bool = False


class PDFParser:
    """
    Authoritative PDF Parser for BIS Standards, Gazette QCOs, and Lab Circulars.
    Uses PyMuPDF (fitz) for vector layout, tables, blocks, and OCR fallback.
    """

    def __init__(self):
        pass

    def parse_pdf(
        self,
        file_input: Union[str, Path, bytes, io.BytesIO],
        filename: str = "document.pdf",
        doc_type: Optional[str] = None,
    ) -> ParsedDocument:
        doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"

        if isinstance(file_input, (str, Path)):
            doc = fitz.open(str(file_input))
            if not filename or filename == "document.pdf":
                filename = Path(file_input).name
        elif isinstance(file_input, bytes):
            doc = fitz.open(stream=file_input, filetype="pdf")
        elif isinstance(file_input, io.BytesIO):
            doc = fitz.open(stream=file_input.getvalue(), filetype="pdf")
        else:
            raise ValueError(f"Unsupported file_input type: {type(file_input)}")

        pages: List[ExtractedPage] = []
        all_tables: List[ExtractedTable] = []
        full_text_parts: List[str] = []
        scanned_count = 0

        doc_meta = dict(doc.metadata or {})

        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]

            # 1. Direct text extraction
            raw_page_text = page.get_text("text") or ""
            images = page.get_images()

            is_scanned = False
            ocr_applied = False
            ocr_quality = 1.0

            # 2. Check for scanned / image-only page
            if len(raw_page_text.strip()) < 50 and len(images) > 0:
                is_scanned = True
                scanned_count += 1
                try:
                    # Attempt PyMuPDF Tesseract OCR integration
                    textpage = page.get_textpage_ocr(language="eng", full=True)
                    ocr_text = textpage.extractText()
                    if ocr_text and len(ocr_text.strip()) > len(raw_page_text.strip()):
                        raw_page_text = ocr_text
                        ocr_applied = True
                        ocr_quality = 0.92
                except Exception:
                    # Gracefully fall back if Tesseract tessdata is not configured
                    ocr_applied = False
                    ocr_quality = 0.50

            # 3. Block extraction with font sizes & heading detection
            blocks_data = page.get_text("dict").get("blocks", [])
            extracted_blocks: List[ExtractedBlock] = []

            for b in blocks_data:
                if b.get("type") == 0:  # text block
                    block_text_parts = []
                    max_font_size = 0.0
                    for line in b.get("lines", []):
                        for span in line.get("spans", []):
                            span_text = span.get("text", "")
                            block_text_parts.append(span_text)
                            size = float(span.get("size", 0.0))
                            if size > max_font_size:
                                max_font_size = size

                    block_text = "".join(block_text_parts).strip()
                    if block_text:
                        # Heuristic: font size >= 11 or clause number pattern indicates heading
                        is_heading = max_font_size >= 12.0 or bool(
                            re.match(r"^(?:Clause\s+)?\d+(\.\d+)*\s+[A-Z]", block_text)
                        )
                        bbox = tuple(b.get("bbox", (0.0, 0.0, 0.0, 0.0)))
                        extracted_blocks.append(
                            ExtractedBlock(
                                page_number=page_num,
                                bbox=bbox,
                                text=block_text,
                                font_size=max_font_size,
                                is_heading=is_heading,
                            )
                        )

            # 4. Table extraction using fitz.Page.find_tables()
            extracted_tables: List[ExtractedTable] = []
            try:
                tabs = page.find_tables()
                if tabs and hasattr(tabs, "tables"):
                    for tab in tabs.tables:
                        tab_data = tab.extract()
                        if tab_data and len(tab_data) > 0:
                            headers = [str(col).strip() if col is not None else "" for col in tab_data[0]]
                            rows = []
                            for row in tab_data[1:]:
                                rows.append([str(c).strip() if c is not None else "" for c in row])

                            # Build markdown table
                            md_lines = []
                            md_lines.append("| " + " | ".join(headers) + " |")
                            md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                            for r in rows:
                                md_lines.append("| " + " | ".join(r) + " |")
                            md_table = "\n".join(md_lines)

                            table_obj = ExtractedTable(
                                page_number=page_num,
                                bbox=tuple(tab.bbox),
                                headers=headers,
                                rows=rows,
                                markdown=md_table,
                            )
                            extracted_tables.append(table_obj)
                            all_tables.append(table_obj)
            except Exception:
                pass

            extracted_page = ExtractedPage(
                page_number=page_num,
                text=raw_page_text,
                blocks=extracted_blocks,
                tables=extracted_tables,
                is_scanned=is_scanned,
                ocr_applied=ocr_applied,
                ocr_quality=ocr_quality,
            )
            pages.append(extracted_page)
            full_text_parts.append(raw_page_text)

        full_raw_text = "\n\n".join(full_text_parts)
        doc.close()

        # 5. Detect Document Category
        classified_type = doc_type or self._classify_document(full_raw_text, filename)

        return ParsedDocument(
            doc_id=doc_id,
            filename=filename,
            page_count=len(pages),
            total_text_length=len(full_raw_text),
            pages=pages,
            raw_text=full_raw_text,
            tables=all_tables,
            metadata=doc_meta,
            detected_doc_type=classified_type,
            scanned_page_count=scanned_count,
            has_scanned_pages=scanned_count > 0,
        )

    def _classify_document(self, text: str, filename: str) -> str:
        text_lower = text.lower()
        fn_lower = filename.lower()

        if "user_" in fn_lower or "tender" in fn_lower or "drawing" in fn_lower:
            return "user_upload"

        # Gazette Quality Control Orders
        if (
            "extraordinary" in text_lower
            or "published by authority" in text_lower
            or "quality control order" in text_lower
            or "s.o." in text_lower
            or "g.s.r." in text_lower
            or "qco" in fn_lower
        ):
            return "qco"

        # Lab recognition circulars
        if (
            "recognized laboratory" in text_lower
            or "scope of recognition" in text_lower
            or "laboratory recognition" in text_lower
            or "circular" in fn_lower
        ):
            return "circular"

        # Technical Indian Standard
        if (
            "indian standard" in text_lower
            or "is :" in text_lower
            or "is 2347" in text_lower
            or "is 17526" in text_lower
            or "foreword" in text_lower
            or "normative references" in text_lower
            or "standard" in fn_lower
        ):
            return "standard"

        return "standard"
