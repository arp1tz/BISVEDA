# BISVEDA: an assistant for Indian Standards and BIS services that shows its source

**Smart India Hackathon 2026 · Problem Statement SIH26107** · AI-powered Intelligent Assistant for Indian Standards and BIS Services · Ministry of Consumer Affairs, Food & Public Distribution · Theme: Smart Automation

---

## 1. The problem

The Bureau of Indian Standards publishes thousands of standards and runs certification, hallmarking and laboratory services. The people who need them most (small manufacturers, jewellers, importers, consumers, students) ask the same questions every day:

- Which standard covers my product?
- Where can I get it tested?
- What does "916" on my gold chain mean, and is my jewellery hallmarked?
- How do I register my shop for hallmarking?

The answers exist, but they are spread across standard PDFs, the LIMS lab portal, the Manak Online directories and application forms. They are mostly in English and written in technical language. A generic chatbot doesn't solve this: it answers fluently from memory, which for a regulator is worse than no answer. A wrong standard number or an invented limit can cost a manufacturer a failed test or a seized consignment.

## 2. Our solution

BISVEDA (BIS + Veda, "knowledge of standards") is a conversational assistant that answers **only** from official BIS material, and shows the exact clause and page every statement came from. When the material doesn't support an answer, it says so and gives the user the correct official route instead of guessing.

One entry point handles text, photo, voice and phone:

| Capability | What the user gets | Where the facts come from |
|---|---|---|
| **Cited answers** | Plain-language answers with `[S1]` source tags. A tag opens the clause text and the PDF at the right page. | Official standard PDFs |
| **Product → standard** | "I make battery-operated toy cars" → IS 15644 (electric toys) and IS 9873 Part 1 (mechanical safety), each with what it covers | Scope clauses of each standard |
| **Hallmark and mark check** | Upload a jewellery photo: reads the purity mark (916 → 22 carat per IS 1417) and HUID, checks the HUID/CM/L **format**, lists the marks a hallmarked article must carry, and points to BIS Care / Manak Online to verify | IS 1417 clauses + deterministic format rules |
| **Photo inspection** | Reads a product label: category, ISI mark, CM/L number, IS number. Shown as "what we read from your photo", never cited as a BIS source | Vision model output, kept separate from BIS evidence |
| **Testing labs** | BIS-recognised labs that have the user's standard **in scope**, on a map, nearest first | BIS LIMS directory (29 labs for our standards) |
| **Hallmarking centres** | Operative Assaying and Hallmarking Centres near a city or the user's location, on a map | Manak Online directory (1,651 centres, 1,512 operative) |
| **Form I drafting** | The jeweller gives their details in one message, in any language; BISVEDA extracts them, cross-checks (e.g. "your address has no PIN code") and delivers an **editable Word draft in the official Form I layout** | Form I PDF (items 1–13, undertaking) |
| **Multilingual** | Ask in English, Hindi, Hinglish, Marathi, Tamil, Telugu, Bengali, Kannada, Malayalam or Gujarati, in native or Roman script; the reply comes in the same language with IS numbers and source tags kept intact | Language detection + English working query + guarded translation |
| **Voice and phone** | Speak instead of typing, hear answers read aloud, or request a phone call and talk to BISVEDA in Hindi, Marathi or English | Speech-to-text, browser read-aloud, telephony voice agent |
| **Employee console** | For BIS staff: knowledge graph of standards, clauses, labs and centres; edition and amendment register per standard; document and clause browser; searchable directories; ingestion workflow | The same knowledge base the chat uses |

## 3. How it works

```
User (text / photo / voice / phone)
  → Understand: language and script, English working query, intent (question, lab finder, centre finder, mark check, Form I, off-topic)
  → Tools: lab directory · centre directory · hallmark/HUID/CM-L format rules · Form I drafter · photo reader
  → Retrieve: exact IS-number match + keyword (BM25) + meaning (local bge-m3 embeddings) + knowledge-graph links
              → fused by reciprocal rank → relevance floor calibrated on a test set
  → Decide (no AI): which standard applies, from the standard's own scope clause
  → Write: the model sees only numbered evidence blocks and must tag every fact
  → Trust gate (no AI): removes any source tag that doesn't exist, any sentence with a number or IS code
              not present in its cited text, and refuses if nothing sourced survives
  → Reply in the user's language, with sources, cards and maps
```

Design decisions that matter:

1. **The model never decides what is true.** Standard selection, relevance, format checks and the final trust gate are deterministic code. The language model only phrases evidence it was given.
2. **Numbers are checked, not trusted.** Every figure in an answer must appear in the cited clause; otherwise that sentence is dropped.
3. **"Not in our documents" is a first-class answer.** Off-topic and uncovered products get an honest reply with the official BIS catalogue or helpline link.
4. **Validity is never claimed.** BISVEDA checks the *format* of a HUID or licence number and sends the user to BIS Care / Manak Online. It never says a mark is genuine, because no public BIS verification API exists.
5. **User evidence is kept apart from BIS evidence.** Photo readings are shown separately and can never become a `[S#]` source.
6. **Works without the AI provider.** If the language model is unavailable, the directories, mark checks, Form I and evidence-only answers still work, and off-topic questions are still refused.
7. **Runs on modest infrastructure.** Embeddings run locally (bge-m3, 1024 dimensions, no API cost); the knowledge base loads into memory; the vision model is called only for photos.

## 4. Measured quality

Measured 2026-09-29 on our hand-written test sets. These are regression checks, not benchmark claims.

| Metric | Result |
|---|---|
| Golden question set (32 cases: helmets, toys, gold, Form I, follow-ups, off-topic, injection, Hindi) | **31 / 32** |
| Correct type of reply (answer / clarify / refusal) | **32 / 32** |
| Wrong standard shown as the main answer | **0** |
| Source tags that resolve to a real clause | **65 / 65** |
| Figures supported by the cited clause | **80 / 80** |
| Multilingual set (9 languages, native and Roman script) | **23 / 24** (last clean run) |

The one known miss is kept in the results: an industrial-helmet question retrieves IS 4151 (motorcycle) as the main standard instead of IS 2925.

## 5. What the prototype holds (honest scope)

- **8 Indian Standards + Form I**, uploaded by BIS employees: IS 4151 and IS 2925 (helmets), IS 15644, IS 9873 Part 1 and Part 3 (toys), IS 1417, IS 1418 and IS 15820 (gold and hallmarking). 760 indexed clauses; a graph of 320 nodes and 343 links.
- **Directories:** 29 BIS LIMS labs with these standards in scope; 1,651 Manak Online hallmarking centres (1,490 geocoded; the remainder are listed without a map pin rather than guessed).
- The editions are the ones in the uploaded PDFs (for example IS 1417 : 1999 with Amendments 1 to 3). The employee console shows exactly which edition answers are based on.
- Full texts of most Indian Standards are sold by BIS. The same pipeline takes any PDF BIS provides; scaling is a matter of ingesting documents, not changing code.

## 6. How BISVEDA differs

Around 170 teams submitted ideas for SIH26107. Most now claim cited answers, "zero hallucination", many languages, a lab finder and HUID checks. What sets BISVEDA apart is **proof and restraint**:

| | Typical approach | BISVEDA |
|---|---|---|
| Accuracy | "Zero hallucination" claimed | Measured on a test set: 0 wrong standards, 100% of source tags valid, 100% of figures supported |
| When the answer isn't in the documents | Falls back to the model's general knowledge | Says so, and links the official catalogue or helpline |
| HUID / licence "verification" | Claims to verify | Format check only, plus the official BIS Care / Manak Online route |
| Languages | Machine translation after the fact | Answers are generated in the user's language from English evidence; IS numbers and source tags are protected and re-checked |
| Data | Synthetic samples or tens of thousands of claimed standards | Real BIS PDFs and official directories, stated counts, visible editions |
| BIS staff | Chat only | Console to see and control the knowledge the assistant answers from |
| Hallmarking | Q&A | End to end: photo check → nearest centre → Form I Word draft |

## 7. Impact

- **Consumers:** check a hallmark or ISI mark from a photo, in their own language, and learn the official way to verify it.
- **MSMEs and manufacturers:** find the applicable standard and a recognised lab in minutes instead of days, with the clause to show a tester.
- **Jewellers:** prepare the Form I application in one conversation and find the nearest operative hallmarking centre.
- **BIS:** fewer repetitive helpline queries, consistent answers traceable to the source document, and a single place to update what the assistant knows when a standard is amended.
- **Accessibility:** voice input, read-aloud, phone calls and Indian-language replies for users who don't read English or can't type easily.

## 8. Roadmap after the prototype

1. Ingest the full BIS standards catalogue and the product-certification scheme documents through the same pipeline.
2. Connect the phone agent to the same cited knowledge base, and pass the web conversation into the call.
3. Staff approval step: new editions and amendments go live only after an officer publishes them.
4. Verification links through official BIS APIs if they are made available (HUID, licence status).
5. Deployment on government cloud (NIC MeghRaj) with the language model hosted in India.

## 9. Technology

Next.js 15, React 19, TypeScript · Groq-hosted open models for understanding and writing · Gemini for reading photos · local bge-m3 embeddings (transformers.js) · BM25 + dense + graph retrieval with reciprocal-rank fusion · Python + PyMuPDF + OCR for offline PDF parsing · Leaflet maps · Whisper speech-to-text · browser speech synthesis · telephony voice bridge for phone calls.
