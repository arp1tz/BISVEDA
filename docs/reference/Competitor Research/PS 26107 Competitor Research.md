# PS 26107 Competitor Research

Sep 29, 2026 · @Rohit

## The field

PS 26107 had **174 idea submissions** on 28 Sep 2026, out of a cap of 500. Submissions close on **30 Sep 2026**. The count grew fast, from 5 on 13 Sep to 174 on 28 Sep (about 25 a day in the last week), so expect roughly 200–250 at close. It ranks 62nd of 240 statements by submissions ([tracker](https://github.com/Zaidusyy/sih-2026-problem-statements), [PS page](https://zaidsayyed.in/tools/sih-problem-statements/sih26107)).

I found **about 55 public GitHub repos** for this problem statement and cloned them. About 40 contain real code. **Five teams published their idea deck** (4 PPTX, 1 PDF). Six teams have live demos. One team (Parakrama, "Maanak") posted a YouTube demo.

The main finding: almost every serious team now claims the same things as BISVEDA. Cited answers, "zero hallucination", refusing when unsure, 22 languages, lab finder, HUID and CM/L checks. These no longer set a team apart. What still does is **measured accuracy**, **honest data scope**, and **deterministic decisions** the LLM cannot override.

## Strongest six competitors

These six have the most working code, real data and engineering discipline. The first three are the real threats. All claims are from their own READMEs, not tested by me.

| Project (repo) | Stack | What stands out | Data scale | Weak spots |
| --- | --- | --- | --- | --- |
| [BIS Standards Navigator](https://github.com/BIS-Standards-AI-Assistant/BIS) · live on [Vercel](https://bis-standards-client.vercel.app) | Next.js 16, Neon Postgres + pgvector, Drizzle, Vercel AI SDK; Ollama llama3.2 first, OpenRouter fallback | Full deterministic pipeline runs before the LLM; LLM output schema has no field for grounding or confidence, so it cannot override them. Works with no LLM at all. On-screen latency. Separate [dataset repo](https://github.com/BIS-Standards-AI-Assistant/BIS-standards-dataset) with Gazette QCOs and eval benchmarks | 1,245 standards, 430 geocoded labs, 618 passing tests, 12/12 retrieval recall, 90% grounding (self-reported) | Government-portal look (strip, 9-item nav) is heavy. Refusal screen is wordy. You already have this as BIS-master.zip |
| [BIS Sahayak](https://github.com/Dhyey2907/Hackathon-2026) | Next.js + FastAPI, Supabase pgvector + FTS, RRF, LLM rerank, Groq, Jina embeddings | \[S1\] markers stripped if they don't resolve; translation only after validation; 223 BIS FAQs as a no-LLM fast path; BIS "What's New" feed; 5-track compliance roadmap; document vault with expiry alerts; full Hindi UI | 6,209 standards (catalogue), 790 labs, 790 chunks | Honest that full IS texts are paywalled. Licence check and several pages are demo data (their own table says so) |
| [SIH26107 Pre-Compliance Platform](https://github.com/shreerajg/SIH) | FastAPI, Chroma, BM25 + rerank, knowledge graph | Product profile → closed candidate list; "Evidence Shield" drops claims citing unretrieved chunks; gap analyzer with 7 fixed statuses; "Compliance Twin" dashboard; amendment diff; `/graph` explorer; accuracy shown live on a Trust page; runs with no API key | 1,655 hallmarking centres, 96 tests | Manufacturer-heavy; consumer side is thinner |
| [BISense](https://github.com/h4ck3rx99-stack/bisense) | FastAPI, SQLite FTS5, fastembed bge-small + ms-marco reranker, any OpenAI-compatible LLM, offline Whisper | Downloads only allow-listed official files (44, robots.txt respected). Validator removes any sentence whose number or IS code is not in the cited source. EN / Hindi / Kannada with voice and read-aloud. Guided path, compare with verbatim numeric table, "Retrieval details" panel. Clean, minimal UI | 735 catalogue, 30 BIS pages, 4 full texts, 174 tests | Demo uses labelled synthetic standards ("DEMO-201") for clause text |
| [BIS Saarthi — HexaMinds](https://github.com/pratik-me/sih-26107) · [demo](https://bis-saarthi.netlify.app/) | Next.js 14 + NestJS monorepo, Prisma, Postgres pgvector, LangChain/LangGraph, cross-encoder | 9 modules (chat, Find My Standard, roadmap, testing DB, labs, hallmarking, consumer hub, PDF report, analytics). Identifier protection in translation (IS 10500, CM/L, HUID). Deck is public | RAG benchmark JSON, Jest + Playwright | Very broad; likely thin in each module |
| [e-BIS Sahayak](https://github.com/0MRX0-00/SIH2026-PS-107) | Next.js 14 + FastAPI, Qdrant, Groq qwen, deterministic fallback | Intent router + ambiguity detector before retrieval, with option chips; returns "insufficient evidence" without calling the LLM; `/retrieval-tester` page; SHA-256 document metadata | Eval dataset in repo | EN / HI / TA only |

## Public idea decks

Five teams left their SIH idea deck in their repo. All follow the official 6-slide template. None shows a measured accuracy number; all lean on claims like "zero hallucination" and "22 languages".

| Deck (team) | Product | Main claims | Tech shown | Notable |
| --- | --- | --- | --- | --- |
| [Hexaminds\_SIH2026\_Presentation.pptx](https://github.com/pratik-me/sih-26107/tree/main/submission) (HexaMinds) | BIS Saarthi | "Retrieve first, reason second, cite everything"; 22 languages + Hinglish; 6.3 crore MSMEs | Next.js, NestJS, Postgres pgvector, Gemini/OpenAI, cross-encoder | Clean pipeline diagram; research slide cites BIS portal, Manakonline, BIS Care |
| [BIS\_SAATHI\_SIH26107\_PRESENTATION.pptx](https://github.com/ishangupta1412/sih26107-bis-saathi) (Strophoid) · [demo](https://bis-saathi-nine.vercel.app/) | BIS Saathi | 350+ QCOs, 22 languages + voice, regex licence check (CM/L, CRS R-number), anonymous whistleblower portal (Sec. 29, DPDP) | Next.js 16, Gemini Flash multimodal, Supabase pgvector, Web Speech API | Cost claim: under ₹10,000/month for 100,000 users; risk table; IS 17802 accessibility; NIC MeghRaj deployment path |
| [ManakMitra\_SIH2026\_v5.pptx](https://github.com/koti-pavan-kumar/sih2026-bis-assistant) (Resonant) · [demo](https://manakmitra-frontend.vercel.app) | ManakMitra | 6-section answer every time; live auto-fetch from bis.gov.in; GPS office finder | React + Vite, FastAPI, ONNX MiniLM + FAISS, Gemini, deep-translator | Only 28 standards indexed; budget slide (₹3.85 lakh); five deck versions in repo |
| [SIH bis Sahayak AI Team Apex.pdf](https://github.com/venkatakarthikeyad19-code/bis-sahayak-ai) (Apex) · [demo](https://bis-sahayak-ai.netlify.app) | BIS Sahayak AI | OCR label scanner verifies rating plates; readiness roadmap | Next.js, FastAPI, Gemini | Short and plain; cites the RAG paper (arXiv 2005.11401) |
| [SIH2026-IDEA-Presentation Team Strophoid.pptx](https://github.com/ishangupta1412/sih26107-bis-saathi) (Strophoid, earlier version) | BIS ai-Saathi | Image-only slides | — | Shows the team iterated from an image deck to a text-heavy one |

One more deck from the sister statement **PS 26108** (BIS procurement standards recommender): [SIH-108.pptx](https://github.com/tejas31007/SIH-108). Same ministry and data, so those teams build similar standard-matching engines.

## Every other team found

Sorted by how much real code the repo has. "Code files" counts .py/.ts/.js files, excluding dependencies. Last commit dates are all September 2026.

| Project | Repo | Code files | Last commit | What's notable |
| --- | --- | --- | --- | --- |
| BIS AI Assistant | [rudraism19/SIH-internal-2026](https://github.com/rudraism19/SIH-internal-2026) | 123 | 15 Sep | Groq for routing + Gemini for answers; Sarvam voice in 9 languages; 4 personas (consumer, domestic, foreign FMCS, electronics CRS); SIT sampling calculator; PDF dossier |
| Manak Saarthi | [shubhamhegishte16/Maanak-Sarthi](https://github.com/shubhamhegishte16/Maanak-Sarthi) | 121 | 27 Sep | Next.js + Express; separate portals for consumer, business, lab, manufacturer, admin |
| ManakAI (decision assistant) | [jivannimase3942-boop/ManakAI](https://github.com/jivannimase3942-boop/ManakAI) · [live](https://manakaii.vercel.app/) | 120 | 25 Sep | LLM only normalises the query; deterministic gates decide; "NO VERIFIED MATCH" state |
| BIS-agent | [t7-rehan/BIS-agent](https://github.com/t7-rehan/BIS-agent) | 113 | 11 Sep | SQLite + Chroma hybrid; 26 standards, 23 products; clarifying questions; offline mock mode |
| BIS (Sindhuja) | [Sindhuja-macha/sih\_BIS](https://github.com/Sindhuja-macha/sih_BIS) | 110 | 25 Sep | FAISS + BM25 + rerank, Supabase, Whisper, OCR |
| BIS Sahayta | [iannzee/BIS-Sahayta](https://github.com/iannzee/BIS-Sahayta) | 102 | 28 Sep | Flutter app + WhatsApp + IndicTrans2; Chroma/FAISS |
| Manak-AI | [BhavyaGarg-sys/Manak-AI](https://github.com/BhavyaGarg-sys/Manak-AI) | 92 | 1 Sep | LangGraph agents, hybrid retrieval, rerank |
| MANAK | [upo2201/MANAK](https://github.com/upo2201/MANAK) | 84 | 22 Sep | Hybrid + rerank, voice |
| BIS-Sahayak-AI | [Tanishk-Pal/BIS-Sahayak-AI](https://github.com/Tanishk-Pal/BIS-Sahayak-AI) | 81 | 19 Sep | Gemini/Groq, OCR; no README |
| BIS Smart Digital Expert | [Nishit7658/SIH-BIS-](https://github.com/Nishit7658/SIH-BIS-) | 79 | 27 Sep | Clause reader with amendment diff; standards comparator; DPDP privacy centre; admin "abstain triage" queue; red-team evaluation |
| ManakSetu-AI | [thefaridkhan/ManakSetu-AI](https://github.com/thefaridkhan/ManakSetu-AI) | 79 | 17 Sep | 50+ standards, BM25 |
| BIS Buddy | [surajpatel07-rgb/BIS---SAHAYAK](https://github.com/surajpatel07-rgb/BIS---SAHAYAK) | 73 | 18 Sep | Synthetic sample documents; falls back to general LLM knowledge when the corpus has nothing (a weakness judges can expose) |
| BIS Saathi (Avinash) | [Avinash3132/BIS-Saathi](https://github.com/Avinash3132/BIS-Saathi) | 67 | 26 Sep | Groq/Ollama, WhatsApp, voice |
| ISense AI | [SujaiRaj/ISense-AI](https://github.com/SujaiRaj/ISense-AI) | 60 | 24 Sep | Procurement angle (tender PDF gap detection); built-in 2-minute "judge demo mode" presets |
| ManakMitra (Resonant) | [koti-pavan-kumar/sih2026-bis-assistant](https://github.com/koti-pavan-kumar/sih2026-bis-assistant) | 57 | 28 Sep | See decks section |
| SIH2026 (Heet Patel) | [HeetPatel8126/SIH2026](https://github.com/HeetPatel8126/SIH2026) | 52 | 19 Sep | Streamlit + FastAPI, IndicTrans |
| BIS SmartGuide | [akhilkvs07-cmd/SIH26107-BIS-SmartGuide](https://github.com/akhilkvs07-cmd/SIH26107-BIS-SmartGuide) | 52 | 13 Sep | Chroma + BM25 + graph |
| BIS-AI | [jagadeesh7780/BIS-AI](https://github.com/jagadeesh7780/BIS-AI) | 51 | 24 Sep | Groq, Chroma hybrid, eval dataset |
| SIH-2026 (phitanshu) | [phitanshu962-netizen/SIH-2026](https://github.com/phitanshu962-netizen/SIH-2026) | 51 | 24 Aug | Early start; Gemini/Ollama, OCR |
| sih-bis-portal | [kamalesh-k05/sih-bis-portal](https://github.com/kamalesh-k05/sih-bis-portal) | 48 | 26 Sep | FastAPI, BM25 + rerank |
| BIS Saathi (Strophoid) | [ishangupta1412/sih26107-bis-saathi](https://github.com/ishangupta1412/sih26107-bis-saathi) | 47 | 22 Sep | See decks section |
| BIS Saathi (ChETaN4) | [ChETaN4-dot/ps107](https://github.com/ChETaN4-dot/ps107) | 44 | 16 Sep | "Standard lifecycle and supersession gate"; 741 standards; golden-question generator; Sarvam |
| SIH\_26107 | [kaladharroyal/SIH\_26107](https://github.com/kaladharroyal/SIH_26107) | 43 | 24 Sep | pgvector + BM25 + rerank, OCR |
| ManakAI (Sharvil) | [SharvilMishra/SIH26107](https://github.com/SharvilMishra/SIH26107) · [live](https://manakai-delta.vercel.app/) | 39 | 14 Sep | Vanilla JS + FastAPI, Supabase pgvector + pg\_trgm, Bhashini, Firebase auth, HUID/CM-L/CRS validation |
| ManakSaar | [tulikasangode/manaksaar-bis-assistant](https://github.com/tulikasangode/manaksaar-bis-assistant) | 34 | 22 Sep | 6-stage LangGraph agent; human review queue for unclear cases; good research on KYS exact-phrase search and CRS portal quirks |
| BIS Sahayak AI (Apex) | [venkatakarthikeyad19-code/bis-sahayak-ai](https://github.com/venkatakarthikeyad19-code/bis-sahayak-ai) | 31 | 17 Sep | See decks section |
| BIS Standards Engine | [rishiiicreates/SIH-2026](https://github.com/rishiiicreates/SIH-2026) · [live](https://bis-standards-engine.vercel.app) | 26 | 1 Sep | LlamaIndex + Neo4j, Bhashini; claims 22,000+ standards |
| BIS-sih-2026 | [saniyagupta-pixel/BIS-sih-2026](https://github.com/saniyagupta-pixel/BIS-sih-2026) | 24 | 24 Sep | Pinecone/Chroma, graph |
| BIS-Standards | [rm0007-sys/BIS-Standards](https://github.com/rm0007-sys/BIS-Standards) | 21 | 18 Sep | 28 standards, Ollama |
| Sihh\_bis | [Itss-Abhinav/Sihh\_bis](https://github.com/Itss-Abhinav/Sihh_bis) | 20 | 28 Sep | Supabase, FastAPI |
| BISense (Sanjay) | [SanjayLadumor/BISense](https://github.com/SanjayLadumor/BISense) | 19 | 20 Sep | Streamlit + LangGraph |
| bis-ai-assistant | [vichu2k7/bis-ai-assistant](https://github.com/vichu2k7/bis-ai-assistant) | 19 | 19 Sep | Ollama + Chroma |
| BIS-AI-Assistant | [harshgaurav-ship-it/BIS-AI-Assistant-SIH26107](https://github.com/harshgaurav-ship-it/BIS-AI-Assistant-SIH26107) | 16 | 25 Sep | Streamlit + FAISS + Ollama |
| BIS-Sakhi | [LEGEND2835/BIS-Sakhi](https://github.com/LEGEND2835/BIS-Sakhi) | 15 | 28 Sep | Early; graph |
| sahayak-bis | [Harsh-0602/sahayak-bis](https://github.com/Harsh-0602/sahayak-bis) | 11 | 25 Sep | Supabase pgvector, hybrid |
| SIH\_METADATASET | [siddhantjagtap150-spec/SIH\_METADATASET](https://github.com/siddhantjagtap150-spec/SIH_METADATASET) | 10 | 15 Sep | Dataset/metadata work only |
| PRAMAAN | [simraann27/pramaan](https://github.com/simraann27/pramaan) | — | 15 Sep | Pressure-cooker flagship demo as a 10-step simulated journey; BGE reranker; abstains below 0.45 |
| PraMaan AI | [smurfs-SIH/PraMaan-AI](https://github.com/smurfs-SIH/PraMaan-AI) | 1 | 27 Sep | Stub README only |
| BIS Standards RAG | [Swechha-prob-sol/SIH2026](https://github.com/Swechha-prob-sol/SIH2026) | — | 9 Sep | Claims 10,000+ standards |
| Near-empty repos | [BISure](https://github.com/Prabin-Jena/BISure), [111111](https://github.com/KRISHNASAGAR708/111111), [Prateek-Mali](https://github.com/Prateek-Mali/SIH-26107-), [BIS\_Sahayak](https://github.com/jayanthcs887/BIS_Sahayak), [BIS-AI26](https://github.com/ranveer-cs50/BIS-AI26), [SYNTRIX](https://github.com/Roopak1/SIH26107-SYNTRIX), [devwithshubham1/sih](https://github.com/devwithshubham1/sih) | ≤ 4 | — | README or plan only |
| Could not open | [Riky-18/SIH26107](https://github.com/Riky-18/SIH26107) (InvictX: photo verification, voice), [iannzee/BIS-Saathi](https://github.com/iannzee/BIS-Saathi), [GitKrishna-source/BIS-SERVICES](https://github.com/GitKrishna-source/BIS-SERVICES) | — | — | Private or removed since indexing |

Live sites with no repo found: [BIS Setu](https://bis-setu-prototype.vercel.app/) and [Maanak Mitra](https://www.maanak-mitra.me/). Maanak Mitra's home page claims 24,000+ standards, IS→ISO/IEC/ASTM export equivalence mapping, a knowledge graph, fee estimates and Bhashini languages. Team Parakrama posted a [demo video of "Maanak"](https://www.youtube.com/watch?v=J0JNiSvCD5g).

## What is now table stakes

Most teams build the same assistant: RAG over BIS PDFs, answers with citations, an abstain rule, a lab finder, HUID/CM-L helpers, a certification roadmap, and a claim of 22 languages. Judges will see these in nearly every deck.

Stack counts below come from a keyword scan of the 40 repos with real code. Treat them as approximate: a mention in code or config counts.

| Component | Repos mentioning it (of 40) | Notes |
| --- | --- | --- |
| Gemini | 29 | Most common LLM and embedding choice |
| FastAPI backend | 29 | Python backend is the default |
| Chroma | 24 | Most common vector store |
| Groq | 20 | Usually for fast routing or generation |
| Reranker (cross-encoder or LLM) | 20 |  |
| BM25 / hybrid search | 19 |  |
| OCR (photo or label reading) | 19 | Photo of product label is a common "wow" feature |
| Speech-to-text | 17 | Mostly browser speech API or Whisper |
| Ollama / local model | 14 | Pitched as data sovereignty |
| pgvector | 13 | Supabase in 7 of these |
| Next.js frontend | 13 | Others use React + Vite |
| FAISS | 8 |  |
| Knowledge graph (Neo4j or networkx) | 8 | Few actually use the graph in answers |
| Qdrant | 6 |  |
| Bhashini | 5 | Sarvam 3, IndicTrans 4 |
| WhatsApp | 5 |  |
| LangGraph | 4 |  |

Features that almost every serious team has: cited answers with an evidence panel, refusal when evidence is weak, clarifying chips for vague questions, lab directory with state/city filter, HUID and CM/L format checks, Scheme I / II / FMCS roadmaps, Hindi plus other languages, and a PDF report export.

## BISVEDA vs the field

Compared against the V9 fix spec, not the current build. If BISVEDA ships V9 Phases 1–2, it has one feature nobody else has and several that only the top three match.

**Where BISVEDA stands out**

| BISVEDA feature (V9) | Who else has something close | How unique |
| --- | --- | --- |
| Knowledge Console: document versions (draft → review → published), only published text is searchable, fact approval queue, audit log | Nishit (abstain triage queue), ManakSaar (human review queue), shreerajg (graph explorer). None control retrieval through versioned publishing | **Unique.** Lead with it for the BIS-staff angle |
| Deterministic adjudication (applies / may apply / related / never shown) with a rule-based "why" | Navigator, shreerajg (closed candidate list), ManakAI (LLM only normalises) | Shared by the top 3; must be shown working, not claimed |
| QCO status from a facts table: in force vs notified-not-in-force with dates, "unknown" instead of guessing "voluntary" | shreerajg (UNABLE\_TO\_VERIFY), ChETaN4 (supersession gate) | Rare. The "notified but not yet in force" state is uncommon |
| Trust gate that drops sentences with unsupported numbers | BISense (same idea), Dhyey (drops unresolved \[S#\]) | Shared by 2 |
| Golden test set with wrong-standard rate as a metric | Navigator (618 tests, 90% grounding), BISense (174 tests), shreerajg (Trust page), ChETaN4, 0MRX0 | Shared, but no deck shows the number. Putting it on a slide is still rare |

**Gaps to close (others already have these)**

- **Catalogue scale.** Dhyey has 6,209 standards and 790 labs; Navigator has 1,245 standards and 430 geocoded labs; shreerajg lists 1,655 hallmarking centres. State BISVEDA's counts and aim for a full catalogue (title, number, committee) even where full text is missing.
- **Honest data scope.** Dhyey and BISense say plainly that full IS texts are paywalled and they only hold catalogue data plus public PDFs. Say the same on the deck and in answers.
- **Works with no LLM.** Navigator, shreerajg and BISense all run in evidence-only mode. BISVEDA's `GENERATION=none` path should be demo-ready as a resilience point.
- **FAQ fast path.** Dhyey answers 223 official BIS FAQs verbatim with no model call. Cheap, fast, fully sourced.
- **Latency on screen.** Navigator shows response time per answer.

**Ideas worth taking**

- A **Trust page** with live golden-set results (shreerajg).
- A collapsible **"Retrieval details"** panel for expert users: query as interpreted, passages, scores, removed sentences (BISense).
- **Translate after validation**, and fall back to English if a citation marker does not survive (Dhyey).
- **Judge demo presets**: 4–5 one-click questions (ISense AI).
- **BIS "What's New" feed** for amendments and new QCOs (Dhyey).
- **Upload a test report, get a gap list** against the standard's clauses (shreerajg, Dhyey).

**Weak spots in the field you can point at (without naming teams)**

- Tiny corpora: several teams index only 18–28 standards.
- Synthetic or sample documents presented as BIS data.
- Fallback to the LLM's general knowledge when the corpus has nothing.
- "Verify HUID / licence" claims with no connection to BIS systems; only format checks are possible without an official API.
- "22 languages" via generic machine translation, with no check that IS numbers and citations survive.

## Deck lessons before 30 Sep

The public decks all read alike, so the deck wins by proof, not by feature count.

1. **Put one measured number on the Technical Approach or Feasibility slide.** For example: "25-question test set, 0 wrong standards shown, X/25 correct". No public deck has one.
2. **Name the one thing nobody else has:** staff control over what the assistant may say (versioned documents + fact approval). Frame it as "BIS officers approve the knowledge".
3. **Show one real answer screenshot** with a source tag and the QCO line (helmet → IS 4151). Decks with only architecture boxes look like the other 170.
4. **State the data scope honestly**: how many standards, labs, QCOs, and that full IS texts are paywalled. This reads as credibility next to decks claiming 20,000+ standards.
5. **Avoid the words every deck uses**: "zero hallucination", "seamless", "comprehensive", "22 languages" without saying how identifiers are protected. Say what the system does when it doesn't know.
6. **Keep the name.** Most teams are "Saathi", "Sahayak", "Manak" or "Mitra" (at least 15 near-duplicates). BISVEDA is distinct; use it in the title and footer of every slide.
7. **Cost line.** Strophoid claims under ₹10,000/month for 100,000 users and ManakMitra shows a ₹3.85 lakh budget. If you have a cost estimate, one line helps the viability score.

## Sources and limits

**Limits.** Feature and accuracy claims come from each team's own README or deck; I did not run their apps. The YouTube demo page and most single-page app demos returned no readable content (YouTube rate-limited the request). Stack counts are a keyword scan and may over-count. Only public repos are covered; most of the \~174 teams have not published code. You had already downloaded 11 of these repos to your folder.

**Sources**

- [SIH 2026 problem statement tracker (submission history)](https://github.com/Zaidusyy/sih-2026-problem-statements)
- [SIH26107 page on zaidsayyed.in](https://zaidsayyed.in/tools/sih-problem-statements/sih26107)
- [BIS Standards Navigator](https://github.com/BIS-Standards-AI-Assistant/BIS) and [its dataset repo](https://github.com/BIS-Standards-AI-Assistant/BIS-standards-dataset)
- [BIS Sahayak (Dhyey2907)](https://github.com/Dhyey2907/Hackathon-2026)
- [SIH26107 Pre-Compliance Platform (shreerajg)](https://github.com/shreerajg/SIH)
- [BISense](https://github.com/h4ck3rx99-stack/bisense)
- [BIS Saarthi (HexaMinds)](https://github.com/pratik-me/sih-26107)
- [e-BIS Sahayak](https://github.com/0MRX0-00/SIH2026-PS-107)
- [ManakMitra (Resonant)](https://github.com/koti-pavan-kumar/sih2026-bis-assistant)
- [BIS Saathi (Strophoid)](https://github.com/ishangupta1412/sih26107-bis-saathi)
- [BIS Sahayak AI (Apex)](https://github.com/venkatakarthikeyad19-code/bis-sahayak-ai)
- [Maanak Mitra live site](https://www.maanak-mitra.me/)
- [Team Parakrama "Maanak" video](https://www.youtube.com/watch?v=J0JNiSvCD5g)
- All other repos are linked in the table above.
