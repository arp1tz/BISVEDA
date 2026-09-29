# BISVEDA demo questionnaire (run order for the video)

Ask these in order. Each one was run on the prototype on 2026-09-29. Scene numbers match `script.txt`.

| # | Scene | Where | Type / do exactly this | Image to attach | What the viewer should see |
|---|---|---|---|---|---|
| Q1 | 2 Cited answer | Home page search | `I make battery-operated toy cars for kids. Which standards apply?` then click **[S1]** | none | IS 15644 + IS 9873 (Part 1), source tags, source panel with clause, page and "Open PDF" |
| Q2 | 2 Honest refusal | Same chat | `domestic pressure cooker stainless steel standard` | none | "We couldn't find this in the documents we hold" + BIS catalogue link |
| Q3 | 3 Hallmark photo | **New chat**, + → attach | `Is this hallmarked? What does the mark mean?` | `prototype/public/samples/hallmarked_gold.jpg` | Photo card (22K916, AB12C3), hallmark card (22K / 916, HUID format valid), BIS Care route, cited list of the 5 marks |
| Q4 | 3 Centre finder | Same chat | `Show hallmarking centres in Jaipur` | none | Map + operative Jaipur centres from Manak Online |
| Q5 | 4 Form I start | **New chat** | `mujhe apni jewellery shop ka hallmarking registration karna hai` | none | One checklist of the 9 details Form I needs |
| Q6 | 4 Form I details | Same chat (paste) | `Shop ka naam Shree Ganesh Jewellers hai, address 14 MG Road, Wardha, Maharashtra, phone 9876543210. Proprietorship hai, owner Utkarsh Kale (Proprietor). Sirf sone ka certificate chahiye. Turnover 2.5 crore hai, koi cancellation nahi hua, hamara mark SGJ hai, contact person Utkarsh Kale proprietor 9876543210` | none | "Noted" list, then one follow-up: the address has no PIN code |
| Q7 | 4 Form I finish | Same chat | `PIN code 442001 hai` → click **Download Word draft (.docx)** → open it | none | "Draft ready", Word file in the official Form I layout with the details filled in |
| Q8 | 5 Hinglish | **New chat** | `sone ke gehno par 916 ka matlab kya hai aur hallmark mein kya kya hota hai` → click read-aloud for 2 s | none | Hinglish answer with source tags + hallmark card; spoken aloud |
| — | 5 Translate page | Header | Language picker → **हिन्दी** | — | Whole interface switches to Hindi |
| Q9 | 5 Answer in picked language | Same chat, typed in English | `Which standards apply to toys for children?` then switch the picker back to English | none | Answer in Hindi: IS 9873 (Part 1) and IS 15644, cited |
| **CALL** | 6 **Live call** (after Q9) | Header → **Talk on Call** | Keep "Start new", enter your mobile, **Call me now** | — | "Call request queued", then the phone rings |
| C1 | 6 On the phone | Phone | "Motorcycle helmet ke liye kaunsa standard hai?" | — | Agent: IS 4151, ISI mark |
| C2 | 6 On the phone | Phone | "Sone ka HUID kaise check karu?" | — | Agent: BIS Care app → Verify HUID |
| E1 | 7 Employee pipeline | `/admin` → **Ingestion** | Choose the PDF, Standard ID `IS 2925:1984`, Title `Industrial Safety Helmets`, Revision `Second Revision`, click **Start Document Ingestion & Indexing** | `example docs uploaded by employees/IS_2925_Specification_for_Industrial_Safety_Helmets_(Second_Revision).pdf` | Steps tick: parsing → clause chunking → vectors → graph linking → live, with the log |
| E2 | 7 Knowledge graph | **Knowledge Graph** tab | Search `IS 1417`, click the node | — | Graph with the node inspector (clauses, links) |
| E3 | 7 Versions | **Documents** tab → IS 1417 → **Version Control & Amendments** | — | — | IS 1417 : 1999, Third Revision, Amendments 1 to 3 from the PDF |

## Where the live call goes
After Q9, when the user-side features are done (scene 6, about 2:25). The page is back in English, and the call leads into the staff section.

## Backup questions (if you have time or one fails)
| Question | Image | Shows |
|---|---|---|
| `What should I check on this toy?` | `prototype/public/samples/toy_car.jpg` | Reads the ISI/CM-L label, cited IS 15644 checks |
| `Check the hallmark on this ring` | `example test images uploaded by user/Hallmarked_ring.webp` | Notices the marks are British (anchor, 375), not BIS |
| `Where can I get electric toys tested near Delhi?` | none | Lab map, Delhi Test House first, cited IS 15644 tests |
| `lahan mulanchya khelnyansathi konte standard pahije` | none | Marathi answer |
| `தங்க நகைகளுக்கு எந்த இந்திய தரநிலை பொருந்தும்?` | none | Tamil answer, IS 1417 |
| `tum kya kya kar sakte ho` | none | What BISVEDA can do, in Hinglish |
| `aaj mausam kaisa hai delhi mein` | none | Polite out-of-scope reply |

## Don't use in the video
- `toy carr.png` (McQueen): weak answer.
- `सोने के आभूषणों की शुद्धता कैसे जांचें?`: still says the method isn't described.
- On the call: number of hallmark marks, cement, water, steel pipes.
- The "Continue from conversation" option in the call dialog: it's labelled "Upcoming".
