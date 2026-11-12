# BIS VEDA — Research: STAIR and the Retrieval Architecture

> Written 2026-11-11 (Opus 5.5). Sources at the end. The paper (Sept 2026) is newer than my training data, so everything below comes from the paper, its code, and the commentary listed, read in this session.

## 1. Verdict

**Do not implement STAIR as a retriever. Do adopt its core idea, which is to treat the document's own structure as the retrieval and evidence unit, inside the existing hybrid RAG.**

STAIR fine-tunes a 7B LLM for each book so that, given a query and the book's table of contents, it generates the title of the best leaf section. That design conflicts with four BIS VEDA requirements:

1. **Documents change.** Staff ingest documents, revisions and amendments, and the answer path must pick them up after approval. STAIR has to be fine-tuned on a GPU for each corpus, so every publish would need retraining.
2. **Most questions span many documents.** "Which standard covers my toy?" is a choice across standards. STAIR was evaluated on one book at a time; a combined ToC for thousands of standards would not fit its 14k-token input.
3. **The inputs don't exist.** None of our 10 PDFs has an embedded outline, and BIS standards do not print a table of contents. A ToC would have to be built from clause numbering, which our chunker already does.
4. **The gain isn't proven for our case and couldn't be measured yet.** The benchmark uses synthetic English questions generated from the same paragraphs that define the answers, and a published review argues that the reported improvement is confounded. Our own eval has no clause-level labels.

The parts of STAIR that suit BIS standards (a clause tree, retrieving at clause level, outputs restricted to valid clause ids, routing by structure) can be built with deterministic code and the components we already run, at no training cost.

## 2. What STAIR is

**Paper.** *STAIR (STructure Aware Information Retriever): A novel dataset and LLM based retriever for document structure augmentation.* Kumar, Pulivarthi, Kumar, Sen, Bhat, Joshi (IBM Research per third-party write-ups). arXiv 2609.03874; v1 3 Sep 2026, v2 13 Oct 2026.

**Problem.** Length-based chunking discards a document's global structure, and LLMs miss information in the middle of long contexts, so retrieval precision matters.

**Method**
- **Retrieval unit.** The leaf nodes of a document's ToC (sections without subsections), identified by their numbered title, e.g. "12.9 Step seven: …".
- **Model.** Mistral-7B-Instruct-v0.2 with a LoRA adapter (r=16, α=32), up to 200 epochs, early stopping on dev Recall@1 (patience 20).
- **Training data.** Synthetic. Mixtral 8x7B generates several questions per paragraph. Each training example is (prompt, query, full ToC) → gold leaf title. The model learns both the corpus content and how to pick a leaf from the ToC.
- **Inference.** Generative retrieval with **constrained decoding** restricted to valid leaf titles. Input up to 14k tokens, output up to 64 tokens. It returns a section title, not text; the text is fetched afterwards.
- It is a descendant of the **Differentiable Search Index (DSI)**: retrieval is stored in model parameters rather than in a vector index.

**Benchmark: SearchTome.** 18 open textbooks across 6 domains (education, finance, law, medicine, natural and social sciences), 179–1,327 pages and 70–396 leaves per book, with ToCs extracted by PyMuPDF. Queries are synthetic, and each book gets its own model.

**Reported results** (average over SearchTome)

| System | R@1 | R@3 | nDCG@3 |
|---|---|---|---|
| Mistral-7B out of the box | 13.8 | 16.4 | 15.4 |
| Claude Haiku 4.5 (zero-shot, given the ToC) | 45.6 | 64.1 | 56.4 |
| BM25 (Elasticsearch) | 59.5 | 77.6 | 70.1 |
| Dense, NV-Embed-v2 zero-shot ("DPR") | 68.7 | 85.4 | 78.6 |
| DSI (fine-tuned, no ToC) | 76.9 | 85.3 | 81.9 |
| **STAIR** (fine-tuned + ToC + constrained decoding) | **82.6** | **90.8** | **87.5** |

"Hallucination" means generating a non-leaf section id, not a false claim in an answer: 0.05% for STAIR. The paper does not report compute, GPU type, training time or latency.

**Limitations the authors state.** It was evaluated only on corpora that already have a ToC. Inducing a ToC for unstructured corpora, enterprise-scale corpora, and multi-hop agentic retrieval are listed as future work.

## 3. What others think

- **Positive.** Elvis Saravia (X) calls it a good answer to the problem of chunking discarding hierarchy. AlphaSignal and Avalency present it as beating RAG baselines. Avalency adds that it is a research approach, not a replacement for vector search, recommends hybrid use, and lists fine-tuning, keeping knowledge current, latency and cost as practical concerns.
- **Critical (Pith referee-style review).** The causal claim is confounded:
  - STAIR uses constrained decoding and DSI doesn't, so near-zero "hallucination" follows from the constraint by construction.
  - STAIR gets 14k input tokens against DSI's 512.
  - Test queries come from the same synthetic process and the same paragraphs as training.
  - There are no confidence intervals and queries are clustered by book.
  - The review proposes running DSI with the same constrained decoding.
  - Verdict: a useful benchmark and an interesting idea, but the experimental design needs major revision.
- **Reproductions.**
  - `hari2353/stair-vs-rag` (Gemma-2-2B QLoRA, one book, 432 training / 50 test queries): fine-tuned 0.86 R@1 against BM25 0.68 and **zero-shot 0.12**. A 50-example run scored 0.0. This supports the ranking but is a very small sample, and it shows the method fails without fine-tuning.
  - `meghanadhpulivarthi/stair-clean`: the training CLI needs a local CUDA GPU (no CPU fallback) and an LLM API for synthetic QA generation, and it takes a single-corpus input. No incremental updates.
  - A Medium from-scratch reimplementation reports that the official code and dataset links were offline when its author checked. I couldn't read that post (403); this point comes from search snippets.
- No Reddit or Hacker News discussion found.

## 4. Fit for BIS documents

| Factor | STAIR assumption | BIS VEDA reality | Fit |
|---|---|---|---|
| Structure source | Printed / embedded ToC | No outline in any of our 10 PDFs; structure exists only as clause numbering (1, 1.1, 3.2, Annex A, Table 2) | Must be induced. We already do this with regex. |
| Retrieval scope | One book, one model | Cross-document: choosing which standard applies is the main question | Poor |
| Corpus change | Static | Staff upload, revisions, amendments, officer approval | Poor (retrain per publish) |
| Query language | Synthetic English | Hindi, Hinglish, Marathi, Tamil etc., layman wording, rewritten to an English working query | Unproven |
| Output needed | Section title | Clause text + page + edition for `[S#]` citations and the numeric trust gate | Needs a second lookup anyway |
| Compute | GPU fine-tune of a 7B model per corpus, 7B inference per query (latency not reported) | CPU-only local embeddings today; hosted LLM on free tier | Poor |
| Zero-shot variant (no training) | Out-of-box Mistral 13.8 R@1; Haiku 45.6; reproduction 0.12 | Below BM25 in every report | Not worth it as a retriever |
| Structural unit | Leaf section ≈ a few pages of a textbook | Leaf clause ≈ 1–3 short paragraphs; whole standards are 20–250 chunks | Good: BIS clause trees are shallower and more regular than textbooks |

**Why the measured gain doesn't transfer.** STAIR's margin over dense retrieval (82.6 vs 68.7 R@1) is against a zero-shot dense retriever with no lexical component, no exact-identifier matching and no reranker, on one book at a time. Our pipeline already has exact IS-number pinning and BM25 and will add a cross-encoder. Precise lookups in BIS documents mostly involve identifiers (IS numbers, clause numbers, table numbers, grades like 916), which exact and lexical matching handle deterministically.

## 5. What we adopt from STAIR (structure-aware retrieval, no training)

| STAIR idea | BIS VEDA version | Cost |
|---|---|---|
| Use the document's global structure | **Clause tree** per document version: every clause, annex, table and figure is a node with parent, children, number, title and page span. Built at ingestion from numbering; stored in the DB. | CPU, deterministic |
| Leaf section as retrieval unit | **Chunk = one leaf clause** (split only if it is too long, never across clauses; tables kept whole). Each chunk is embedded with its path ("IS 4151 › 7 Tests › 7.3 Impact absorption"). | Re-chunk once |
| Retrieve a section, then read it | **Two-level context assembly**: retrieve chunks, expand to the full clause plus its parent heading and any referenced table, within a token budget. This also fixes the 500-char truncation (TD-03). | Code only |
| Constrained decoding to valid ids | Already our rule: the answer may cite only `[S#]` from the package, and the trust gate strips unknown ones. For explicit references, a **deterministic clause resolver**: "IS 4151 clause 7.3", "Table 2 of IS 1417" resolve straight to tree nodes. | Code only |
| ToC as a navigation map | **Clause-level graph expansion**: follow "see 5.2", "given in Table 3" and IS cross-references as edges at query time (TD-04). | Code only |
| Structure-aware ranking | Aggregate candidate scores per clause and section, so many weak hits under one clause can lift it, and a cross-encoder reranks the clauses. | Reranker inference (CPU OK at top-30) |

**Possible later experiment** (only if the retrieval eval shows a recall gap that the above doesn't close): *ToC routing*. After hybrid retrieval picks the top 1–3 standards, give a strong hosted LLM those standards' clause trees (small: a few thousand tokens) and ask for up to 3 clause ids, validated against the tree, as one more RRF list. This needs no training. It is not planned now because every zero-shot result reported (13.8, 45.6, 0.12) is below BM25.

## 6. Recommended retrieval architecture

Most of this was already the stated direction (README, D2, D6). The STAIR-derived changes are structural.

```
Query ─► understand (lang, English working query, intent, explicit refs: IS no., part, clause, table)
      ─► candidate generation (parallel)
           1 exact     IS number → standard; IS + clause/table → clause node (deterministic)
           2 lexical   BM25 over chunk text + clause path
           3 dense     bge-m3 (1024-d) cosine, pgvector HNSW
           4 graph     clause tree (parent/child/sibling) + cross-references + standard references
                       + conversation-active standard
      ─► filter: current published edition (+ in-force amendments) unless the user asks for an old edition
      ─► RRF (k=60) at chunk level ─► aggregate to clause level
      ─► cross-encoder rerank top ~30 (bge-reranker-v2-m3)
      ─► relevance floor on reranker score (recalibrated)
      ─► adjudicate (rule-based applicability from scope clauses; unchanged)
      ─► context assembly: full clause + parent heading + referenced table(s), token-budgeted, numbered [S#]
      ─► answer (LLM sees evidence only) ─► trust gate (unchanged rules, on full clause text)
```

**Expected measurable effects** (to verify with the retrieval eval, not assumed):
- clause-level Recall@5 up from the clause tree, path-in-embedding text and graph expansion;
- fewer false trust-gate drops once evidence isn't truncated;
- fewer off-topic follow-ups passing the floor once the floor uses reranker scores;
- correct edition naming once versions exist.

**Compute.** Everything runs on CPU. bge-m3 is already local. The reranker (bge-reranker-v2-m3, ~568M parameters) on 30 pairs is likely the largest added latency on CPU and must be measured; the fallback is a smaller reranker or rerank only when the top scores are close. No GPU and no training.

## 7. How a decision like this will be validated

A change ships only if it improves a **retrieval-only eval**: gold clause ids per question; Recall@1/5, MRR, wrong-standard rate; no LLM calls. That eval doesn't exist yet. Creating it needs your approval (see the roadmap). Any future STAIR-style experiment must beat the improved hybrid on that eval by more than its run-to-run noise before it enters the pipeline.

## Sources
- Paper: [arXiv 2609.03874](https://arxiv.org/abs/2609.03874) · [HTML v2](https://arxiv.org/html/2609.03874v2)
- Code (author account, official status unconfirmed): [meghanadhpulivarthi/stair-clean](https://github.com/meghanadhpulivarthi/stair-clean)
- Reproduction: [hari2353/stair-vs-rag](https://github.com/hari2353/stair-vs-rag)
- Critical review: [Pith](https://pith.science/paper/2609.03874)
- Commentary: [Avalency](https://www.avalency.com/blog/ibm-stair-enterprise-ai-retrieval) · [AlphaSignal](https://alphasignal.ai/news/stair-beats-every-rag-baseline-by-reading-documents-like-a-table-of-contents) · [Elvis Saravia on X](https://x.com/omarsar0/status/2096648881962652046) · [alphaXiv](https://www.alphaxiv.org/abs/2609.03874) · [Medium reimplementation](https://medium.com/@mithilmaske/i-built-stair-from-scratch-a-retriever-that-returns-section-names-not-chunk-ids-22882a7b4cd8) (not readable, 403)
