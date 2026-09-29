# BISVEDA: 12 screenshots for the deck

8 user-side frames and 4 employee-side frames. Hallmarking gets 4 of the 8 user frames (photo check, centre finder, Form I, Hinglish answer) because it is the most complete end-to-end story we have: consumer checks a ring, finds a centre, jeweller registers.

Every query below was run against the live prototype on 2026-09-29 after the P13 fixes. Take the frames on desktop at 1440 x 900 (16:10) unless marked, browser zoom 100%, light theme.

Before you start:
- Fresh Groq quota (don't run `eval:rag` first). A tired quota degrades answers.
- Set `GEMINI_VISION_MODEL=gemini-3.5-flash-lite` in `prototype/.env` and restart `npm run dev`. Photos then read in about 4 to 6 s instead of up to 45 s.
- Start each frame in a **new chat** so the sidebar and history look clean.

---

## User side (8)

| # | Frame | Exactly what to do | What must be visible in the shot | Slide caption idea |
|---|---|---|---|---|
| U1 | **Home page** | Open `http://localhost:3000`. Don't type anything. | Hero search box, attach (+) and mic buttons, language picker, "Speak with BISVEDA on Call" pill, coverage chips (Helmets, Toys, Gold). | One box for text, photo, voice and phone. |
| U2 | **Cited answer + source drawer** | Ask: *I make battery-operated toy cars for kids. Which standards apply?* Then click the first `[S1]` pill. | Answer naming IS 15644 (and IS 9873), `[S#]` pills, the right-side **Source drawer** open with the clause text, page number and "Open PDF". | Every claim traces to a clause and page. |
| U3 | **Gold photo: hallmark check** | Attach `prototype/public/samples/hallmarked_gold.jpg`, type *Is this hallmarked? What does the mark mean?* | "What we read from your photo" card (22K916, AB12C3), **Hallmark card** (22K / 916, HUID format valid), the line pointing to BIS Care, and the cited sentence listing the 5 marks a hallmarked article must carry `[S#]`. | Reads the hallmark, explains it from IS 1417, never calls it genuine. |
| U4 | **Hallmarking centre finder** | Ask: *Show hallmarking centres in Jaipur* | AHC card with the **map** and the list (LAWAT, Shri Salasar Balaji, Savitree...), Operative status, "Manak Online, retrieved 2026-09-27" line. | 1,651 official centres, nearest first. |
| U5 | **Form I: chat to Word file** (split frame) | New chat: *mujhe apni jewellery shop ka hallmarking registration karna hai*, then paste the details from `DEMO_QUESTIONS.md` (Form I block), answer the PIN question, then click **Download Word draft (.docx)** and open the file in Word. Left half: chat with the Form I card showing **Draft ready**. Right half: the .docx open in Word. | The cross-question ("address has no PIN code"), the green "Draft ready" badge, the orange download button, and Word showing "Form I ... Bureau of Indian Standards" with the filled items. | Jeweller registration drafted in chat, delivered as an editable Word file. |
| U6 | **Hinglish answer** | Ask: *sone ke gehno par 916 ka matlab kya hai aur hallmark mein kya kya hota hai* | Reply in Hinglish (Roman script), Hallmark card, `[S#]` citations kept inside the Hinglish text. Language picker visible in the header. | Ask the way you speak. Citations survive translation. |
| U7 | **Testing labs with map** | Ask: *Where can I get electric toys tested near Delhi?* | Labs card **map** with pins, lab list (Delhi Test House first) with "standards in scope", and the cited list of IS 15644 tests above it. | BIS LIMS labs that actually test your standard. |
| U8 | **Honest refusal** | Ask: *domestic pressure cooker stainless steel standard* | Refusal card: "We couldn't find this in the documents we hold", the list of standards we do cover, and the **Search the official BIS Standards Catalogue** link. | When the documents don't cover it, BISVEDA says so. |

Swap options if one frame disappoints:
- U6 alternative: Tamil, *தங்க நகைகளுக்கு எந்த இந்திய தரநிலை பொருந்தும்?* (answers IS 1417 in Tamil with citations).
- U8 alternative: the **Talk on Call** modal from the chat header (phone field, "Call me now"), if the phone feature has no slide of its own.
- Mobile shot: U6 at iPhone width (DevTools, 390 x 844) to show the layout adapts.

---

## Employee side (4)

Log in at `http://localhost:3000/admin` (password in `ADMIN_PASSWORD`, default `bisveda2026`).

| # | Frame | Exactly what to do | What must be visible | Slide caption idea |
|---|---|---|---|---|
| E1 | **Knowledge graph** | Knowledge Graph tab. Search `IS 1417`, click the node so the **Node inspector** opens. Hover so neighbours highlight. | Dark canvas graph, colour legend (standards, clauses, labs, centres, forms), the inspector listing clauses and linked items. | Every standard, clause, lab and centre linked in one graph (320 nodes, 343 links). |
| E2 | **Version control and amendments** | Documents tab, pick **IS 1417**, switch to **Version Control & Amendments**. | Active edition card, revision history (superseded IS 8844), amendments log (Amendment No. 2, 2007), "Add amendment" button. | BIS staff control which edition the assistant answers from. |
| E3 | **Ingestion pipeline** | Ingestion tab. Choose a PDF (any IS PDF from `example docs uploaded by employees`), fill the form, click **Start Document Ingestion & Indexing**, capture when steps 1 to 4 show ticks and the log is visible. | 5-step stepper (verify and parse, clause chunking, embeddings, graph linking, publish) with the live log. | New standards go in through a checked pipeline, not by editing code. |
| E4 | **Official directories** | Directory tab, AHC table, filter state = Rajasthan (or search "Jaipur"). | Table with recognition number, name, district, status, validity, pagination, and the source + retrieval date. | 29 LIMS labs and 1,651 Manak Online centres, with source and date. |

Honesty note for the deck: the ingestion tab (E3) is a prototype of the staff workflow; the knowledge base itself is rebuilt with `npm run kb:build`. Say "ingestion workflow" rather than implying uploads are live-indexed.

---

## What not to capture

- The helmet query (it has its own slide).
- The McQueen toy photo (`toy carr.png`): the answer is weak (it only discusses IS 15644).
- *सोने के आभूषणों की शुद्धता कैसे जांचें?* (native Hindi purity question): it still says the documents don't describe the method. Use the Hinglish U6 query instead.
- The "Continue from conversation" option in the call modal. It is labelled "Upcoming".
