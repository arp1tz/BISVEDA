import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
import uuid

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from bisveda.adjudication.adjudicator import EvidenceAdjudicator
from bisveda.config.settings import get_settings
from bisveda.contracts.dossier import ComplianceDossier
from bisveda.contracts.events import StageEvent, StageEventKind, StageName
from bisveda.generation.evidence_only import EvidenceOnlySynthesizer
from bisveda.generation.llm_client import MultiProviderLLMClient
from bisveda.ingestion.job_runner import JobRunner
from bisveda.ingestion.sample_generator import generate_sample_pdf
from bisveda.orchestration.dossier_builder import DossierBuilder
from bisveda.retrieval.engine import RetrievalEngine
from bisveda.taxonomy.validator import TaxonomyValidator
from bisveda.trust.trust_gate import TrustGate
from bisveda.storage.sqlite_store import SQLiteStore
from bisveda.contracts.mission import (
    ComplianceMission,
    ComplianceStep,
    DecisionExplainability,
    MissionStatus,
    ProductIdentity,
    StepEvaluationState,
)

app = FastAPI(
    title="BISVEDA V8 API Gateway",
    description="Sovereign AI Assistant for Indian Standards and BIS Services",
    version="8.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()
retrieval_engine = RetrievalEngine()
job_runner = JobRunner()
adjudicator = EvidenceAdjudicator(relevance_floor=settings.flags.relevance_floor)
trust_gate = TrustGate(strict_tier_enforcement=settings.flags.strict_tier_enforcement)
synthesizer = EvidenceOnlySynthesizer()
llm_client = MultiProviderLLMClient()
dossier_builder = DossierBuilder()
taxonomy_validator = TaxonomyValidator()
store = SQLiteStore()
from bisveda.connectors.registry import ConnectorRegistry
from bisveda.retrieval.geocoder import LocalPINCentroidGeocoder
from bisveda.ingestion.outdated_refs import OutdatedReferenceChecker, OutdatedReferenceReport
from bisveda.ingestion.quarantine import QuarantineSandbox
from bisveda.ingestion.pdf_parser import PDFParser
from bisveda.routing import CanonicalIntent, IntentRouter, RouteType, RoutingDecision

connector_registry = ConnectorRegistry()
geocoder = LocalPINCentroidGeocoder()
pdf_parser = PDFParser()
outdated_checker = OutdatedReferenceChecker()
quarantine_sandbox = QuarantineSandbox()
intent_router = IntentRouter()

class QueryRequest(BaseModel):
    query: str = Field(..., description="User query text", example="domestic pressure cookers stainless steel")
    user_type: str = Field(default="msme", description="User persona: msme, startup, large, consumer")
    language: str = Field(default="en", description="Language code: en or hi")
    market: str = Field(default="domestic", description="Target market: domestic or export")
    entities: Dict[str, Any] = Field(default_factory=dict, description="Extracted entities")

class HealthResponse(BaseModel):
    status: str
    version: str
    app_name: str
    generation_enabled: bool
    taxonomy_valid: bool
    relevance_floor: float

@app.get("/api/v8/health", response_model=HealthResponse)
def get_health():
    tax_rep = taxonomy_validator.validate(raise_on_error=False)
    return HealthResponse(
        status="healthy",
        version=settings.version,
        app_name=settings.app_name,
        generation_enabled=settings.flags.generation_enabled,
        taxonomy_valid=tax_rep.is_valid,
        relevance_floor=settings.flags.relevance_floor,
    )

@app.get("/api/v8/taxonomy")
def get_taxonomy():
    report = taxonomy_validator.validate(raise_on_error=False)
    return report.model_dump()

@app.get("/api/v8/standards")
def list_standards(
    q: Optional[str] = Query(None, description="Search term or IS number"),
    limit: int = Query(50, ge=1, le=100),
):
    if q:
        results = retrieval_engine.search(q, limit=limit)
        return {"total": len(results), "standards": results}
    return {"total": len(retrieval_engine.standards), "standards": retrieval_engine.standards[:limit]}

@app.get("/api/v8/labs")
def list_labs(
    standard: Optional[str] = Query(None, description="Standard number filter, e.g. IS 2347"),
    city: Optional[str] = Query(None, description="City name"),
    state: Optional[str] = Query(None, description="State name"),
    pin: Optional[str] = Query(None, description="6-digit Indian PIN code for distance sorting"),
    near: Optional[str] = Query(None, description="City or district for proximity sorting"),
    q: Optional[str] = Query(None, description="General query filter"),
    limit: int = Query(50, ge=1, le=200),
):
    labs = dossier_builder.labs
    filtered = labs
    if city:
        city_lower = city.lower()
        filtered = [l for l in filtered if city_lower in (l.get("city") or "").lower()]
    if state:
        state_lower = state.lower()
        filtered = [l for l in filtered if state_lower in (l.get("state") or "").lower()]
    if q:
        q_lower = q.lower()
        filtered = [
            l for l in filtered
            if q_lower in (l.get("name") or "").lower() or q_lower in (l.get("city") or "").lower()
        ]

    origin = pin or near
    if origin:
        filtered = geocoder.sort_labs_by_distance(filtered, origin)

    return {"total": len(filtered), "origin": origin, "labs": filtered[:limit]}


@app.get("/api/v8/sources")
def list_authorized_sources():
    """
    V8 Canonical Spec §9.1: Authorized Source Registry provenance.
    """
    sources = connector_registry.list_sources()
    return {"total": len(sources), "sources": sources}


@app.post("/api/v8/sources/sync")
def sync_authorized_sources(export_snapshots: bool = Query(True)):
    """
    V8 Canonical Spec §9.4: Synchronizes sources and exports offline snapshots.
    """
    results = connector_registry.sync_all(export_snapshots=export_snapshots)
    return {"success": True, "results": results}


@app.get("/api/v8/updates")
def list_updates(category: Optional[str] = Query(None)):
    """
    V8 Canonical Spec §4.9: What's New & Gazette notifications.
    """
    conn = connector_registry.get_connector("whats_new")
    records = conn.fetch_records(use_offline_snapshot=True) if conn else []
    if category:
        c_lower = category.lower()
        records = [r for r in records if c_lower in r.get("category", "").lower()]
    return {"total": len(records), "updates": records}


@app.get("/api/v8/faqs")
def list_faqs(category: Optional[str] = Query(None)):
    """
    V8 Canonical Spec §9.2: Official Verbatim FAQs.
    """
    conn = connector_registry.get_connector("faqs")
    records = conn.fetch_records(use_offline_snapshot=True) if conn else []
    if category:
        c_lower = category.lower()
        records = [r for r in records if c_lower in r.get("category", "").lower()]
    return {"total": len(records), "faqs": records}

@app.get("/api/v8/qcos")
def list_qcos(q: Optional[str] = Query(None, description="Filter QCOs")):
    qcos = dossier_builder.qcos
    if q:
        q_lower = q.lower()
        filtered = [
            item for item in qcos
            if q_lower in str(item.get("full_title") or "").lower() or
               q_lower in str(item.get("standard_number") or "").lower() or
               q_lower in str(item.get("legal_source") or "").lower() or
               q_lower in str(item.get("order_title") or "").lower() or
               any(q_lower in str(s).lower() for s in item.get("standards_covered", []))
        ]
        return {"total": len(filtered), "qcos": filtered}
    return {"total": len(qcos), "qcos": qcos}

@app.post("/api/v8/routing/route", response_model=RoutingDecision)
def route_query_endpoint(req: QueryRequest):
    """
    Two-Stage Query Routing & Intent Classification Endpoint.
    """
    return intent_router.route(req.query, language=req.language)


@app.post("/api/v8/dossier", response_model=ComplianceDossier)
def generate_dossier(req: QueryRequest):
    """
    Direct synchronous endpoint generating ComplianceDossier.
    """
    query_id = f"Q-{uuid.uuid4().hex[:8].upper()}"
    route_dec = intent_router.route(req.query, language=req.language)

    if route_dec.route_type in (RouteType.GIBBERISH_REJECT, RouteType.OFF_TOPIC_REFUSAL):
        pkg = adjudicator.adjudicate(
            query_id=query_id,
            query=req.query,
            intent="product_match",
            candidates=[],
            language=req.language,
        )
        trust_res = trust_gate.verify("", pkg)
        dossier = dossier_builder.build(pkg, trust_res, user_type=req.user_type, market=req.market)
        dossier.executive_summary = route_dec.rejection_reason or route_dec.clarification_prompt or "Query rejected."
        store.save_dossier(dossier)
        return dossier

    merged_entities = {**route_dec.entities, **req.entities}
    if route_dec.route_type == RouteType.EXACT_SHORTCUT and route_dec.standard_record:
        cand = dict(route_dec.standard_record)
        cand["relevance_score"] = 1.0
        cand["search_channels"] = ["exact_is"]
        candidates = [cand]
    else:
        candidates = retrieval_engine.search(req.query, limit=5)

    pkg = adjudicator.adjudicate(
        query_id=query_id,
        query=req.query,
        intent=route_dec.intent.value,
        candidates=candidates,
        entities=merged_entities,
        language=req.language,
    )
    raw_text, slots, provider = llm_client.generate(pkg)
    trust_res = trust_gate.verify(raw_text, pkg)
    dossier = dossier_builder.build(pkg, trust_res, user_type=req.user_type, market=req.market)
    store.save_dossier(dossier)
    return dossier

@app.post("/api/v8/query")
async def stream_query(req: QueryRequest):
    """
    Server-Sent Events streaming endpoint emitting real stage events
    (stage.started, stage.completed) followed by the ComplianceDossier (D38).
    """
    async def event_generator():
        query_id = f"Q-{uuid.uuid4().hex[:8].upper()}"

        def make_event(stage: StageName, kind: StageEventKind, duration_ms: Optional[int] = None, payload: Dict = None):
            return StageEvent(
                event=kind,
                turn_id=query_id,
                stage=stage,
                duration_ms=duration_ms,
                payload=payload or {},
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        # 1. Understand stage (Two-Stage Intent Router)
        t0 = time.perf_counter()
        ev_start = make_event(StageName.UNDERSTAND, StageEventKind.STAGE_STARTED)
        yield f"data: {ev_start.model_dump_json()}\n\n"
        await asyncio.sleep(0.01)

        route_dec = intent_router.route(req.query, language=req.language)

        if route_dec.route_type == RouteType.GIBBERISH_REJECT:
            dur = int((time.perf_counter() - t0) * 1000)
            ev_done = make_event(
                StageName.UNDERSTAND,
                StageEventKind.STAGE_COMPLETED,
                dur,
                {"status": "rejected", "reason": route_dec.rejection_reason},
            )
            yield f"data: {ev_done.model_dump_json()}\n\n"
            ev_clarify = make_event(
                StageName.CLARIFY,
                StageEventKind.CLARIFICATION_REQUIRED,
                payload={
                    "is_ambiguous": True,
                    "reason": route_dec.rejection_reason,
                    "prompt": route_dec.clarification_prompt,
                    "suggestions": ["IS 2347", "pressure cookers", "packaged drinking water"],
                },
            )
            yield f"data: {ev_clarify.model_dump_json()}\n\n"
            pkg = adjudicator.adjudicate(query_id=query_id, query=req.query, candidates=[], language=req.language)
            trust_res = trust_gate.verify("", pkg)
            dossier = dossier_builder.build(pkg, trust_res, user_type=req.user_type, market=req.market)
            dossier.executive_summary = route_dec.clarification_prompt or "Please enter a valid search query."
            store.save_dossier(dossier)
            dossier_payload = json.dumps({"type": "dossier", "dossier": dossier.model_dump()})
            yield f"data: {dossier_payload}\n\n"
            return

        if route_dec.route_type == RouteType.OFF_TOPIC_REFUSAL:
            dur = int((time.perf_counter() - t0) * 1000)
            ev_done = make_event(
                StageName.UNDERSTAND,
                StageEventKind.STAGE_COMPLETED,
                dur,
                {"status": "refused", "reason": route_dec.rejection_reason},
            )
            yield f"data: {ev_done.model_dump_json()}\n\n"
            pkg = adjudicator.adjudicate(query_id=query_id, query=req.query, candidates=[], language=req.language)
            trust_res = trust_gate.verify("", pkg)
            dossier = dossier_builder.build(pkg, trust_res, user_type=req.user_type, market=req.market)
            dossier.executive_summary = route_dec.rejection_reason or "This query is outside the BIS compliance domain."
            store.save_dossier(dossier)
            dossier_payload = json.dumps({"type": "dossier", "dossier": dossier.model_dump()})
            yield f"data: {dossier_payload}\n\n"
            return

        # Pre-RAG disambiguation trap
        disambig = retrieval_engine.check_ambiguity(req.query)
        if disambig.get("is_ambiguous") or route_dec.missing_attributes:
            clarify_payload = dict(disambig)
            if route_dec.missing_attributes:
                clarify_payload["missing_attributes"] = route_dec.missing_attributes
            ev_clarify = make_event(
                StageName.CLARIFY,
                StageEventKind.CLARIFICATION_REQUIRED,
                payload=clarify_payload,
            )
            yield f"data: {ev_clarify.model_dump_json()}\n\n"

        dur = int((time.perf_counter() - t0) * 1000)
        ev_done = make_event(
            StageName.UNDERSTAND,
            StageEventKind.STAGE_COMPLETED,
            dur,
            {
                "query_clean": req.query.strip(),
                "route_type": route_dec.route_type.value,
                "intent": route_dec.intent.value,
                "is_ambiguous": disambig.get("is_ambiguous", False) or bool(route_dec.missing_attributes),
            },
        )
        yield f"data: {ev_done.model_dump_json()}\n\n"

        # 2. Retrieve stage (SQLite FTS5 + BM25 + Exact IS Regex + RRF)
        t0 = time.perf_counter()
        ev_start = make_event(StageName.RETRIEVE, StageEventKind.STAGE_STARTED)
        yield f"data: {ev_start.model_dump_json()}\n\n"

        merged_entities = {**route_dec.entities, **req.entities}
        if route_dec.route_type == RouteType.EXACT_SHORTCUT and route_dec.standard_record:
            cand = dict(route_dec.standard_record)
            cand["relevance_score"] = 1.0
            cand["search_channels"] = ["exact_is"]
            candidates = [cand]
        else:
            candidates = retrieval_engine.search(req.query, limit=5)

        dur = int((time.perf_counter() - t0) * 1000)
        top_cand_num = candidates[0].get("standard_number") if candidates else None
        top_cand_score = candidates[0].get("relevance_score") if candidates else 0.0
        ev_done = make_event(
            StageName.RETRIEVE,
            StageEventKind.STAGE_COMPLETED,
            dur,
            {
                "candidates_found": len(candidates),
                "top_standard": top_cand_num,
                "top_score": top_cand_score,
                "is_shortcut": route_dec.route_type == RouteType.EXACT_SHORTCUT,
            },
        )
        yield f"data: {ev_done.model_dump_json()}\n\n"

        # 3. Adjudicate stage (Rule 2: Adjudicate before generation)
        t0 = time.perf_counter()
        ev_start = make_event(StageName.ADJUDICATE, StageEventKind.STAGE_STARTED)
        yield f"data: {ev_start.model_dump_json()}\n\n"
        pkg = adjudicator.adjudicate(
            query_id=query_id,
            query=req.query,
            intent=route_dec.intent.value,
            candidates=candidates,
            entities=merged_entities,
            language=req.language,
        )
        dur = int((time.perf_counter() - t0) * 1000)
        ev_done = make_event(
            StageName.ADJUDICATE,
            StageEventKind.STAGE_COMPLETED,
            dur,
            {
                "grounding_state": pkg.adjudication.grounding_state.value,
                "confidence": pkg.adjudication.confidence_label.value,
                "relevance_top1": pkg.adjudication.relevance_top1,
                "citable_items": len(pkg.citable_evidence),
            },
        )
        yield f"data: {ev_done.model_dump_json()}\n\n"


        # 4. Generate stage (Multi-Provider LLM with SlotSchema or Evidence-Only fallback)
        t0 = time.perf_counter()
        ev_start = make_event(StageName.GENERATE, StageEventKind.STAGE_STARTED)
        yield f"data: {ev_start.model_dump_json()}\n\n"
        raw_text, slots, provider_used = llm_client.generate(pkg)
        dur = int((time.perf_counter() - t0) * 1000)
        ev_done = make_event(
            StageName.GENERATE,
            StageEventKind.STAGE_COMPLETED,
            dur,
            {
                "mode": provider_used,
                "slots": ["summary", "why_explanations", "step_explanations", "next_action_guidance"],
            },
        )
        yield f"data: {ev_done.model_dump_json()}\n\n"

        # 5. Trust stage (Tier Honesty, Citation Survival, Bracket Normalization)
        t0 = time.perf_counter()
        ev_start = make_event(StageName.TRUST, StageEventKind.STAGE_STARTED)
        yield f"data: {ev_start.model_dump_json()}\n\n"
        trust_res = trust_gate.verify(raw_text, pkg)
        dur = int((time.perf_counter() - t0) * 1000)
        ev_done = make_event(
            StageName.TRUST,
            StageEventKind.STAGE_COMPLETED,
            dur,
            {
                "passed": trust_res.passed,
                "verified_citations": len(trust_res.verified_citations),
                "stripped_citations": len(trust_res.stripped_citations),
                "caveats": trust_res.caveats,
            },
        )
        yield f"data: {ev_done.model_dump_json()}\n\n"

        # 6. Dossier Assembly & Emission
        dossier = dossier_builder.build(pkg, trust_res, user_type=req.user_type, market=req.market)
        store.save_dossier(dossier)
        dossier_payload = json.dumps({"type": "dossier", "dossier": dossier.model_dump()})
        yield f"data: {dossier_payload}\n\n"

        # Turn Completed Event
        ev_completed = make_event(
            StageName.TRUST,
            StageEventKind.TURN_COMPLETED,
            payload={"turn_id": query_id, "dossier_id": dossier.dossier_id},
        )
        yield f"data: {ev_completed.model_dump_json()}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# -------------------------------------------------------------
# Ingestion Pipeline Endpoints (§7.11 & D43)
# -------------------------------------------------------------

class SampleUploadRequest(BaseModel):
    sample_name: str
    doc_type: str = "qco"
    is_number: Optional[str] = None
    committee: Optional[str] = "MED 32"
    sample_type: Optional[str] = None


@app.post("/api/v8/ingest/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    committee: Optional[str] = Form("MED 32"),
    is_user_upload: bool = Form(False),
    auto_publish: bool = Form(False),
):
    contents = await file.read()
    job = await job_runner.create_and_run_job(
        file_bytes=contents,
        filename=file.filename or "uploaded_document.pdf",
        doc_type=doc_type,
        committee=committee,
        is_user_upload=is_user_upload,
        auto_publish=auto_publish,
    )
    return job.model_dump()


@app.post("/api/v8/ingest/upload-sample")
async def upload_sample_document(req: SampleUploadRequest):
    st = req.sample_type
    if not st:
        if req.doc_type == "qco" or "cooker" in req.sample_name.lower():
            st = "cookers_qco"
        elif req.doc_type == "standard" or "flask" in req.sample_name.lower():
            st = "flasks_standard"
        elif req.doc_type == "user_upload" or "tender" in req.sample_name.lower():
            st = "user_tender"
        else:
            st = "cookers_qco"

    pdf_bytes = generate_sample_pdf(st)
    job = await job_runner.create_and_run_job(
        file_bytes=pdf_bytes,
        filename=req.sample_name,
        doc_type=req.doc_type,
        committee=req.committee or "MED 32",
        is_user_upload=req.doc_type == "user_upload",
        auto_publish=False,
    )
    return job.model_dump()


@app.get("/api/v8/ingest/jobs")
def get_ingestion_jobs():
    jobs = job_runner.list_jobs()
    return {"total": len(jobs), "jobs": [j.model_dump() for j in jobs]}


@app.get("/api/v8/ingest/jobs/{job_id}")
def get_ingestion_job(job_id: str):
    job = job_runner.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job.model_dump()


@app.get("/api/v8/ingest/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    job = job_runner.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    async def event_generator():
        async for ev in job_runner.subscribe_events(job_id):
            yield f"data: {ev.model_dump_json()}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/v8/ingest/publish/{job_id}")
async def publish_ingestion_job(job_id: str):
    job = job_runner.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    success = await job_runner.publish_job(job_id)
    if success:
        # Instantly sync into Core RAG RetrievalEngine
        doc_dict = {
            "standard_id": job.id,
            "standard_number": job.standard_number or job.extracted_metadata.get("isNumber") or f"DOC-{job.id}",
            "full_title": job.extracted_metadata.get("title") or job.extracted_metadata.get("orderTitle") or job.filename,
            "short_title": job.standard_number or job.filename,
            "product_category": job.committee,
            "scope": job.extracted_metadata.get("orderTitle") or job.filename,
            "materials": ["Stainless Steel"] if "steel" in job.filename.lower() else [],
            "keywords": [job.doc_type, job.committee, "ingested_v8"],
            "testing_parameters": ["Clause Testing"],
        }
        retrieval_engine.index_document(doc_dict, [c.model_dump() for c in job.chunks])
    return {"success": success, "job": job.model_dump()}


@app.get("/api/v8/ingest/quarantine")
def list_quarantine():
    records = job_runner.quarantine.list_records()
    return {"total": len(records), "records": [r.model_dump() for r in records]}


@app.post("/api/v8/ingest/quarantine/scan/{media_id}")
def scan_quarantine(media_id: str):
    rec = job_runner.quarantine.get_record(media_id)
    if not rec:
        for r in job_runner.quarantine.list_records():
            if media_id in r.media_id or media_id in r.filename:
                rec = r
                break
    if not rec:
        raise HTTPException(status_code=404, detail=f"Quarantine item {media_id} not found")
    is_injected, flags, verdict = job_runner.quarantine.scan_for_injection(rec.extracted_text_preview)
    rec.prompt_injection_detected = is_injected
    rec.injection_flags = flags
    rec.audit_verdict = verdict
    return rec.model_dump()


# -------------------------------------------------------------
# Compliance Mission & Dossier Endpoints (V8 Canonical Spec §6 & §7)
# -------------------------------------------------------------

class CreateMissionRequest(BaseModel):
    title: str
    product_name: str
    category: Optional[str] = None
    material: Optional[str] = None
    grade: Optional[str] = None
    capacity_rating: Optional[str] = None
    intended_use: Optional[str] = None
    market_context: str = "domestic"
    user_type: str = "msme"
    pincode: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    additional_attributes: Dict[str, Any] = Field(default_factory=dict)


class UpdateStepRequest(BaseModel):
    step: ComplianceStep
    state: StepEvaluationState
    summary: Optional[str] = None
    why: Optional[str] = None
    evidence_ids: List[str] = Field(default_factory=list)
    change_triggers: List[str] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    turn_id: str
    reason: str
    comment: Optional[str] = None
    rating: Optional[int] = None


@app.post("/api/v8/missions", response_model=ComplianceMission)
def create_mission(req: CreateMissionRequest):
    """
    Creates a new persistent Compliance Mission (V8 Canonical Spec §6).
    """
    mission_id = f"MSN-{uuid.uuid4().hex[:8].upper()}"
    identity = ProductIdentity(
        name=req.product_name,
        category=req.category,
        material=req.material,
        grade=req.grade,
        capacity_rating=req.capacity_rating,
        intended_use=req.intended_use,
        market_context=req.market_context,
        user_type=req.user_type,
        pincode=req.pincode,
        location_city=req.location_city,
        location_state=req.location_state,
        additional_attributes=req.additional_attributes,
    )
    mission = ComplianceMission(
        mission_id=mission_id,
        title=req.title,
        status=MissionStatus.DRAFT,
        product_identity=identity,
    )
    store.save_mission(mission)
    return mission


@app.get("/api/v8/missions")
def list_missions(
    limit: int = Query(50, ge=1, le=100),
    status: Optional[MissionStatus] = None,
    user_type: Optional[str] = None,
):
    missions = store.list_missions(limit=limit, status=status, user_type=user_type)
    return {"total": len(missions), "missions": [m.model_dump() for m in missions]}


@app.get("/api/v8/missions/{mission_id}", response_model=ComplianceMission)
def get_mission(mission_id: str):
    mission = store.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    return mission


@app.patch("/api/v8/missions/{mission_id}/step", response_model=ComplianceMission)
def update_mission_step(mission_id: str, req: UpdateStepRequest):
    mission = store.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")

    explainability = None
    if req.why:
        explainability = DecisionExplainability(
            why=req.why,
            evidence_ids=req.evidence_ids,
            change_triggers=req.change_triggers,
        )

    mission.update_step(
        step=req.step,
        state=req.state,
        summary=req.summary,
        explainability=explainability,
    )
    store.save_mission(mission)
    return mission


@app.delete("/api/v8/missions/{mission_id}")
def delete_mission(mission_id: str):
    deleted = store.delete_mission(mission_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    return {"deleted": True, "mission_id": mission_id}


@app.get("/api/v8/dossiers/{dossier_id}", response_model=ComplianceDossier)
def get_dossier(dossier_id: str):
    dossier = store.get_dossier(dossier_id)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Dossier {dossier_id} not found")
    return dossier


@app.post("/api/v8/feedback")
def submit_feedback(req: FeedbackRequest):
    fid = store.save_feedback(
        turn_id=req.turn_id,
        reason=req.reason,
        comment=req.comment,
        rating=req.rating,
    )
    return {"success": True, "feedback_id": fid}


@app.get("/api/v8/feedback")
def get_all_feedback(limit: int = Query(50, ge=1, le=100)):
    items = store.list_feedback(limit=limit)
    return {"total": len(items), "feedback": items}


@app.post("/api/v8/documents/review", response_model=OutdatedReferenceReport)
async def review_document(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
):
    raw_text = ""
    target_filename = filename or "document.txt"
    file_bytes = b""

    if file:
        target_filename = file.filename or "uploaded_document.pdf"
        file_bytes = await file.read()
        if target_filename.lower().endswith(".pdf"):
            try:
                parsed = pdf_parser.parse_pdf(file_bytes, filename=target_filename)
                raw_text = parsed.raw_text
            except Exception:
                raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
    elif text:
        raw_text = text
        file_bytes = text.encode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Either file upload or text content must be provided.")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Document contains no readable text.")

    # Quarantine sandbox audit (Rule 9 / D43)
    quarantine_sandbox.isolate_upload(
        file_bytes=file_bytes,
        filename=target_filename,
        extracted_text=raw_text,
    )

    # Scan for outdated/superseded/withdrawn Indian Standards citations
    report = outdated_checker.scan_text(text=raw_text, doc_name=target_filename)

    # Persist in SQLiteStore
    store.save_outdated_report(
        report_id=report.report_id,
        doc_name=report.doc_name,
        findings=[f.model_dump() for f in report.findings],
    )

    return report


@app.get("/api/v8/documents/reports/{report_id}", response_model=OutdatedReferenceReport)
def get_document_report(report_id: str):
    data = store.get_outdated_report(report_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return OutdatedReferenceReport(**data)

