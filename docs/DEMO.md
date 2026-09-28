# BISVEDA Prototype — 5-Minute Demonstration Walkthrough

This document outlines the step-by-step 5-minute live demonstration flow for the BISVEDA prototype.

---

## Prerequisites
1. Ensure dev server is running on `http://localhost:3000`.
2. Check environment variables are populated:
   - `GROQ_API_KEY` (Llama-3.3-70b-versatile for pipeline reasoning)
   - `GEMINI_API_KEY` (Gemini 2.5 Flash for vision image inspection)
   - `ADMIN_PASSWORD` (default: `bisveda2026`)

---

## 5-Minute Demo Script

### Step 1: Landing Page & Standards Registry
- Navigate to `http://localhost:3000`.
- **Showcase:**
  - Minimal clean interface with Ministry of Consumer Affairs / BIS branding.
  - "Coverage · 8 Indian Standards" banner showing the closed corpus:
    - Helmets: `IS 4151`, `IS 2925`
    - Toys: `IS 9873 (Part 1 & 3)`, `IS 15644`
    - Hallmarking: `IS 1417`, `IS 1418`, `IS 15820`
  - 4 verified domain pills: **Helmets**, **Toys**, **Gold Jewellery & Hallmarking**, **Form I**.
  - Action cards for quick entry.

### Step 2: Mandatory Standard & QCO Query
- Click the **Helmets** chip (or ask: *"Which Indian Standard applies to motorcycle helmets and is it mandatory under QCO?"*).
- **Showcase:**
  - Real-time pipeline stage indicators: *Understanding your question → Searching official BIS documents → Checking the evidence → Writing a clear answer*.
  - Grounded answer citing `IS 4151` and gazetted Quality Control Order requirements.
  - Interactive `[S1]`, `[S2]` citation pills. Click any citation to open the slide-over **Source Drawer**, displaying the verbatim excerpt from the standard and a link to view the exact page in the official PDF.

### Step 3: Clause-Specific Deep Dive
- Send follow-up: *"What impact test and conditioning does it need?"*
- **Showcase:**
  - Multi-turn conversation retention.
  - Direct clause citation from `IS 4151` regarding impact absorption tests, conditioning temperatures, and drop heights.

### Step 4: Testing Laboratories Lookup (LIMS)
- Ask: *"Where can I test my helmet in Mumbai?"* (or ask *"labs near me"* with browser geolocation enabled).
- **Showcase:**
  - Automated detection of lab intent.
  - **LabsCard** rendering official BIS LIMS accredited laboratories filtered by `IS 4151` in scope.
  - Interactive Leaflet map pins showing laboratory locations.
  - Direct links to BIS LIMS portal records and recognition validity dates.

### Step 5: Multimodal Product Inspection
- Upload sample helmet photo (e.g. `public/samples/helmet_with_isi.jpg` or `example test images uploaded by user/helment.jpg`).
- Query: *"Please inspect this helmet and verify if marks are present."*
- **Showcase:**
  - Multimodal vision inspection via Gemini 2.5 Flash.
  - **ImageReadCard** showing:
    - Detected category & product guess.
    - Extracted label text.
    - Mark presence (ISI mark recognized or missing).
  - **MarkCard** displaying extracted CM/L licence number and a clear reminder: *"Verify licence status on the BIS Care app or Manak Online."*

### Step 6: Hallmarking Centre Directory (AHC)
- Click `+ New Chat` or start a new conversation.
- Ask: *"Show hallmarking centres in Jaipur"*
- **Showcase:**
  - Intent routed to `find_ahc`.
  - **AhcCard** rendering operative Assaying & Hallmarking Centres from the 1,651 official Manak Online directory entries.
  - Displays recognition number, district, operative status, recognized metals (Gold / Silver), and validity.

### Step 7: Gold Jewellery Hallmark Inspection
- Upload gold jewellery photo (`public/samples/hallmarked_gold.jpg`).
- Query: *"Is this gold jewellery hallmarked? Check the HUID."*
- **Showcase:**
  - Vision detection extracts purity marks (e.g., 916 / 22K) and alphanumeric 6-character HUID.
  - **HallmarkCard** displays purity fineness, karat calculation, and format check (6 alphanumeric characters).
  - Direct CTA directing user to the official BIS Care app for database authenticity check.

### Step 8: Form I Hallmarking Application Flow
- Ask: *"I want to register my jewellery shop for hallmarking"*
- **Showcase:**
  - Form I conversational agent engages the user.
  - Returns **FormICard** drafting the 13 statutory fields under Schedule I, Form I.
  - Form fields update interactively across turns.
  - Click **"Open printable draft"** → navigates to `/form-i/print`.
  - Clean, official printable layout (`@media print` ready) with disclaimer: *"DRAFT: prepared with BISVEDA, submit on Manak Online"*.

### Step 9: Employee Console & Knowledge Graph (`/admin`)
- Navigate to `http://localhost:3000/admin`.
- If unauthenticated, redirect to `/admin/login` → enter admin password (`bisveda2026`).
- **Showcase:**
  1. **Knowledge Graph Tab:**
     - Dark canvas `#1e1e1e` Obsidian-style force-directed graph rendering all 320 nodes and 343 edges.
     - Color-coded node types (Standards, Clauses, Labs, Domains, References, Forms).
     - Node sizing proportional to degree.
     - Hover over nodes to highlight neighbors and fade the rest.
     - Search box to locate `std:IS 4151` → click to open **NodeInspector**, displaying linked clauses, cited references, and connected accredited labs.
     - Toggle depth (1 or 2) for local graph inspection.
  2. **Documents Tab:**
     - Overview of the 9 official PDFs with chunk counts.
     - Click **Open PDF** to launch the real document via `/api/docs/[docId]`.
     - Integrated **Chunk Browser** allowing full-text search across all 760 indexed chunks.
  3. **Directory Tab:**
     - Searchable table for 29 BIS LIMS Testing Laboratories with standards in scope.
     - Searchable table for 1,651 Manak Online Assaying & Hallmarking Centres with pagination and filters.
     - Official portal retrieval timestamps.

---

## Demonstration Summary
BISVEDA successfully delivers an enterprise-grade AI interface for Indian Standards and conformity assessment, providing 100% grounded citations, real multimodal mark verification, official directory geolocations, and full administrative transparency without hallucinations or fabricated data.
