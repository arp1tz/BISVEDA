import re
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field

from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.contracts.evidence import EvidenceClass
from bisveda.ingestion.pdf_parser import ExtractedTable, ParsedDocument


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    standard_number: Optional[str] = None
    clause_number: Optional[str] = None
    title: str = ""
    content: str
    tier: KnowledgeTier = KnowledgeTier.TIER_B
    kind: str = "clause_text"  # clause_text, qco_order, lab_record, table, user_upload
    page_number: int = 1
    evidence_class: EvidenceClass = EvidenceClass.OFFICIAL_SOURCE
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentChunker:
    """
    Structural chunker for Indian Standards, Gazette Quality Control Orders,
    and Lab Circulars. Emits metadata-rich chunks tagged with clause numbers,
    tiers (Tier A/B/C), and evidence classes (Rule 9 / A15).
    """

    def __init__(self):
        # Patterns for Indian Standard clauses e.g. "4.1 Material Requirements" or "Clause 4.1" or "1 Scope"
        self.clause_heading_regex = re.compile(
            r"(?:^|\n)\s*(?:CLAUSE\s+)?(\d+(?:\.\d+)*)\s+([A-Z][A-Za-z0-9\s,\-\(\)\/\–]{2,70})(?=\n|$)",
            re.MULTILINE,
        )
        # Patterns for Gazette Paragraphs e.g. "1. Short title and commencement" or "2. Compulsory use"
        self.gazette_para_regex = re.compile(
            r"(?:^|\n)\s*(\d+)\.\s+([A-Z][A-Za-z0-9\s,\-\(\)\/]{2,70})(?=\n|\s*—|\s*-\s*)",
            re.MULTILINE,
        )

    def chunk_document(
        self,
        parsed_doc: ParsedDocument,
        standard_number: Optional[str] = None,
        is_user_upload: bool = False,
    ) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        doc_type = parsed_doc.detected_doc_type

        # Rule 9 / C8: User uploads are strictly non-citable
        evidence_class = (
            EvidenceClass.USER_PROVIDED
            if (is_user_upload or doc_type == "user_upload")
            else EvidenceClass.OFFICIAL_SOURCE
        )

        # Detect standard number if not provided
        if not standard_number:
            std_match = re.search(r"\b(IS\s*[:\-]?\s*\d+(?::\s*\d{4})?)\b", parsed_doc.raw_text, re.IGNORECASE)
            if std_match:
                standard_number = re.sub(r"\s+", " ", std_match.group(1)).upper()

        # 1. Process document page-by-page or by sections
        if doc_type == "qco":
            chunks.extend(self._chunk_qco(parsed_doc, standard_number, evidence_class))
        elif doc_type == "standard":
            chunks.extend(self._chunk_standard(parsed_doc, standard_number, evidence_class))
        else:
            chunks.extend(self._chunk_generic(parsed_doc, standard_number, evidence_class))

        # 2. Add extracted tables as specialized table chunks
        for tbl in parsed_doc.tables:
            tbl_title = f"Table on Page {tbl.page_number} ({', '.join(tbl.headers[:3]) if tbl.headers else 'Data'})"
            chunk_id = f"CHK-TBL-{uuid.uuid4().hex[:8].upper()}"
            chunks.append(
                DocumentChunk(
                    chunk_id=chunk_id,
                    document_id=parsed_doc.doc_id,
                    standard_number=standard_number,
                    clause_number=f"Table-P{tbl.page_number}",
                    title=tbl_title,
                    content=tbl.markdown,
                    tier=KnowledgeTier.TIER_C if doc_type == "standard" else KnowledgeTier.TIER_B,
                    kind="table",
                    page_number=tbl.page_number,
                    evidence_class=evidence_class,
                    metadata={"headers": tbl.headers, "row_count": len(tbl.rows)},
                )
            )

        # Fallback if no chunks were extracted from text
        if not chunks:
            chunk_id = f"CHK-FALLBACK-{uuid.uuid4().hex[:8].upper()}"
            chunks.append(
                DocumentChunk(
                    chunk_id=chunk_id,
                    document_id=parsed_doc.doc_id,
                    standard_number=standard_number,
                    clause_number="1.0",
                    title=parsed_doc.filename,
                    content=parsed_doc.raw_text[:2000] if parsed_doc.raw_text else "Document uploaded.",
                    tier=KnowledgeTier.TIER_B,
                    kind="user_upload" if is_user_upload else "clause_text",
                    page_number=1,
                    evidence_class=evidence_class,
                )
            )

        return chunks

    def _chunk_standard(
        self, parsed_doc: ParsedDocument, standard_number: Optional[str], evidence_class: EvidenceClass
    ) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []

        for page in parsed_doc.pages:
            text = page.text
            if not text.strip():
                continue

            matches = list(self.clause_heading_regex.finditer(text))
            if not matches:
                # Page paragraph chunk
                paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
                for p_idx, p in enumerate(paragraphs):
                    chunk_id = f"CHK-{uuid.uuid4().hex[:8].upper()}"
                    chunks.append(
                        DocumentChunk(
                            chunk_id=chunk_id,
                            document_id=parsed_doc.doc_id,
                            standard_number=standard_number,
                            clause_number=f"P{page.page_number}.{p_idx + 1}",
                            title=f"Page {page.page_number} Section",
                            content=p,
                            tier=KnowledgeTier.TIER_C,
                            kind="clause_text",
                            page_number=page.page_number,
                            evidence_class=evidence_class,
                        )
                    )
                continue

            for i, m in enumerate(matches):
                clause_num = m.group(1).strip()
                clause_title = m.group(2).strip()
                start_pos = m.start()
                end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                clause_content = text[start_pos:end_pos].strip()

                # Determine tier:
                # Tier C for technical requirements, numeric limits, testing methods
                # Tier B for Scope, Normative References, Terminology
                tier = KnowledgeTier.TIER_C
                if clause_num in ("1", "1.0") or "scope" in clause_title.lower():
                    tier = KnowledgeTier.TIER_B
                elif clause_num in ("2", "2.0") or "references" in clause_title.lower():
                    tier = KnowledgeTier.TIER_B

                chunk_id = f"CHK-CL-{uuid.uuid4().hex[:8].upper()}"
                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        document_id=parsed_doc.doc_id,
                        standard_number=standard_number,
                        clause_number=clause_num,
                        title=f"Clause {clause_num}: {clause_title}",
                        content=clause_content,
                        tier=tier,
                        kind="clause_text",
                        page_number=page.page_number,
                        evidence_class=evidence_class,
                    )
                )

        return chunks

    def _chunk_qco(
        self, parsed_doc: ParsedDocument, standard_number: Optional[str], evidence_class: EvidenceClass
    ) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []

        for page in parsed_doc.pages:
            text = page.text
            if not text.strip():
                continue

            matches = list(self.gazette_para_regex.finditer(text))
            if not matches:
                # Chunk by paragraphs
                paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
                for p_idx, p in enumerate(paragraphs):
                    chunk_id = f"CHK-QCO-{uuid.uuid4().hex[:8].upper()}"
                    chunks.append(
                        DocumentChunk(
                            chunk_id=chunk_id,
                            document_id=parsed_doc.doc_id,
                            standard_number=standard_number,
                            clause_number=f"Order-P{page.page_number}.{p_idx+1}",
                            title=f"Gazette Notification Page {page.page_number}",
                            content=p,
                            tier=KnowledgeTier.TIER_B,
                            kind="qco_order",
                            page_number=page.page_number,
                            evidence_class=evidence_class,
                        )
                    )
                continue

            for i, m in enumerate(matches):
                para_num = m.group(1).strip()
                para_title = m.group(2).strip()
                start_pos = m.start()
                end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                para_content = text[start_pos:end_pos].strip()

                chunk_id = f"CHK-QCO-P{para_num}-{uuid.uuid4().hex[:6].upper()}"
                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        document_id=parsed_doc.doc_id,
                        standard_number=standard_number,
                        clause_number=f"Para {para_num}",
                        title=f"Paragraph {para_num}: {para_title}",
                        content=para_content,
                        tier=KnowledgeTier.TIER_B,
                        kind="qco_order",
                        page_number=page.page_number,
                        evidence_class=evidence_class,
                    )
                )

        return chunks

    def _chunk_generic(
        self, parsed_doc: ParsedDocument, standard_number: Optional[str], evidence_class: EvidenceClass
    ) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        for page in parsed_doc.pages:
            paragraphs = [p.strip() for p in page.text.split("\n\n") if len(p.strip()) > 30]
            for idx, p in enumerate(paragraphs):
                chunk_id = f"CHK-GEN-{uuid.uuid4().hex[:8].upper()}"
                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        document_id=parsed_doc.doc_id,
                        standard_number=standard_number,
                        clause_number=f"Sec-{page.page_number}.{idx+1}",
                        title=f"Section {page.page_number}.{idx+1}",
                        content=p,
                        tier=KnowledgeTier.TIER_B,
                        kind="user_upload" if evidence_class == EvidenceClass.USER_PROVIDED else "clause_text",
                        page_number=page.page_number,
                        evidence_class=evidence_class,
                    )
                )
        return chunks
