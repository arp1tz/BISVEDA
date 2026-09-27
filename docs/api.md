# BISVEDA — API Reference

> **Base URL:** `/api/v1/` (production) · `/api/v8/` (prototype)
> **Protocol:** REST + Server-Sent Events (SSE)
> **Auth:** Keycloak OIDC (production) · API key (prototype)

---

## 1. Core Endpoints

### 1.1 Query / Turn Submission

```
POST /v1/turns
Content-Type: application/json
Accept: text/event-stream
```

Submits a text/voice-transcript/media query. Returns an SSE stream of stage events and dossier sections.

**Request Body:**
```json
{
  "text": "Steel bottle ke liye standard kya hai?",
  "conversation_id": "uuid",           // optional; creates new if absent
  "media_ids": ["uuid"],               // optional; uploaded media references
  "mode": "business",                  // consumer|business|student|laboratory
  "language": "hi"                     // optional; auto-detected if absent
}
```

**SSE Response Events:**
```
event: turn.accepted
data: {"turn_id":"uuid","language":"hi","mode":"business"}

event: stage.started
data: {"stage":"understand","turn_id":"uuid"}

event: stage.completed
data: {"stage":"understand","duration_ms":120,"intent":"product_match"}

event: stage.started
data: {"stage":"retrieve","turn_id":"uuid"}

event: section.ready
data: {"section":"standards","payload":{...}}

event: section.ready
data: {"section":"regulatory","payload":{...}}

event: answer.delta
data: {"text":"Based on the BIS catalogue..."}

event: trust.result
data: {"caveats":["metadata_only_notice"],"stripped_markers":[],"blocked":false}

event: turn.completed
data: {"latency_ms":3200,"trace_id":"abc123"}
```

### 1.2 Clarification Response

```
POST /v1/turns/{turn_id}/clarify
```

**Request Body:**
```json
{
  "selected_options": ["domestic_use", "stainless_steel_304"],
  "free_text": null
}
```

### 1.3 Media Upload

```
POST /v1/media
Content-Type: multipart/form-data
```

Uploads image/document/audio. Validated, quarantined, assigned `media_id`.

**Response:**
```json
{
  "media_id": "sha256-hash",
  "type": "image",
  "status": "quarantined",
  "expires_at": "2026-09-27T00:00:00Z"
}
```

---

## 2. Standards Endpoints

### 2.1 Catalogue Search

```
GET /v1/standards?q=pressure+cooker&group=household&status=current&tier=A
```

**Response:**
```json
{
  "results": [{
    "id": "uuid",
    "is_number": "IS 2347:2017",
    "title_en": "Domestic Pressure Cookers",
    "title_hi": "घरेलू प्रेशर कुकर",
    "status": "current",
    "committee": "MTD 10",
    "year": 2017,
    "tier": "B",
    "product_groups": ["Cookers & Utensils"]
  }],
  "total": 3,
  "page": 1
}
```

### 2.2 Standard Passport

```
GET /v1/standards/{id}
```

Returns full standard details including scope, regulatory context, amendments, related standards.

### 2.3 Plain-Language Summary

```
GET /v1/standards/{id}/explain?lang=hi
```

Returns AI-generated plain-language explanation, labelled as `ai_interpretation`.

### 2.4 Standard Comparison

```
GET /v1/compare?ids=uuid1,uuid2,uuid3
```

---

## 3. Lab & AHC Endpoints

### 3.1 Lab Search

```
GET /v1/labs?is=IS+2062&pin=411001&radius_km=100&state=Maharashtra
```

**Response:**
```json
{
  "results": [{
    "name": "National Test House, Pune",
    "address": "...",
    "distance_km": 12.5,
    "accredited_standards": ["IS 2062", "IS 1786"],
    "validity": "2027-03-31",
    "contact": "...",
    "coordinates": {"lat": 18.52, "lng": 73.85}
  }],
  "total": 5
}
```

### 3.2 AHC Search

```
GET /v1/ahcs?pin=110001&fineness=916
```

---

## 4. Consumer Endpoints

### 4.1 Mark Verification

```
POST /v1/verify/cml
Content-Type: application/json
```

```json
{
  "identifier": "CM/L-1234567",
  "media_id": "sha256"   // optional image
}
```

**Response:**
```json
{
  "shape_valid": true,
  "verification_route": {
    "method": "BIS Care App",
    "url": "https://bis.gov.in/verify",
    "steps": ["Download BIS Care app", "Enter CM/L number", "View certificate details"]
  },
  "caveat": "Shape validation only. Verify via official channels.",
  "image_extraction": {
    "detected": "CM/L-1234567",
    "confidence": 0.87,
    "class": "user_provided"
  }
}
```

---

## 5. Document Endpoints

### 5.1 Document Review

```
POST /v1/documents/{media_id}/review
```

Returns identity check + outdated-reference report.

### 5.2 Dossier Endpoints

```
GET /v1/dossiers/{id}
PATCH /v1/dossiers/{id}/checklist
GET /v1/dossiers/{id}/export.pdf
```

---

## 6. Form I Endpoints

```
POST /v1/forms/form-i          # Create form job
PATCH /v1/forms/form-i/{id}    # Update field values
GET /v1/forms/form-i/{id}/draft.pdf  # Generate draft PDF
```

---

## 7. Admin Endpoints

```
POST /v1/admin/ingest                    # Upload document for ingestion
GET  /v1/admin/jobs/{id}/events          # SSE stream of ingestion events
POST /v1/admin/jobs/{id}/retry?from=step # Retry from failed step
GET  /v1/admin/connectors                # List connectors with health
POST /v1/admin/connectors/{id}/run       # Manual connector trigger
```

---

## 8. Utility Endpoints

```
GET  /v1/updates?category=qco&week=2026-W38    # Updates feed
POST /v1/feedback                               # Submit typed feedback
GET  /v1/quality                                # Latest eval summary
GET  /v1/health                                 # Liveness/readiness
```

---

## 9. Prototype API Routes (Current)

The prototype uses Next.js API routes under `/api/v8/`:

| Route | Maps To |
|---|---|
| `POST /api/v8/query` | Turn submission (SSE) |
| `POST /api/v8/ingest` | Document ingestion |
| `GET /api/v8/ingest/status` | Ingestion job status |
| `POST /api/v8/vision` | Image analysis |
| `GET /api/v8/standards/search` | Catalogue search |
| `GET /api/v8/labs/search` | Lab search |

---

## 10. Rate Limits

| Tier | Limit |
|---|---|
| Anonymous | 30 requests/minute |
| Authenticated (consumer/business) | 120 requests/minute |
| Partner API | 600 requests/minute |
| Admin | Unlimited |

---

## 11. Error Responses

```json
{
  "error": {
    "code": "OUT_OF_CORPUS",
    "message": "BISVEDA answers from the BIS catalogue and public documents. No matching information found.",
    "next_action": "Visit https://standards.bis.gov.in for the full catalogue.",
    "trace_id": "abc123"
  }
}
```

Error codes: `OUT_OF_CORPUS`, `OUT_OF_SCOPE`, `INSUFFICIENT_EVIDENCE`, `RATE_LIMITED`, `VALIDATION_ERROR`, `INJECTION_BLOCKED`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`
