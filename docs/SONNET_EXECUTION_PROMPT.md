# Sonnet Execution Prompt

Paste the **Kickoff** block into a fresh Claude Code session. Set `/model` and effort to match the tag on the task in `TODO.md`. Before starting each phase, paste that phase's prompt from the list below.

## Kickoff
```
You are the implementation engineer for the BISVEDA prototype (C:\BISVEDA). Use a strict Markdown state-tracking workflow.

Context budget rules:
- Read ONLY: CLAUDE.md, progress.md, and the current phase section of TODO.md. Read other files only when the task names them.
- No directory-wide searches outside prototype/src and prototype/scripts. Never read C:\BISVEDA_archive or docs/reference unless I ask.
- Reference earlier reads instead of re-reading. Use offset/limit on large files.

Loop per task:
1. Set the task to In Progress in progress.md (Current Task).
2. Implement it, reusing the files the task names. Don't rewrite working code from scratch.
3. Run the task's "Done when" check and show the command output.
4. Update progress.md: the Latest State Blocks (≤5 dense lines) and Known Blockers. Tick the task in TODO.md.
5. Run `npm run typecheck` (in prototype/), then commit "P{n}.{m}: <summary>".

STOP and ask me if:
- a scraper hits a CAPTCHA, a login, or an unexpected HTML structure
- a model id is unavailable
- an eval gate fails twice
- a task would need fabricated data
- a file the task names doesn't exist

Acknowledge these rules, then begin P0.1.
```

## Per-phase prompts
- **P0** `[Sonnet/Low–Med]`: "Execute P0.1–P0.5. Archive by moving files, never by deleting them. After 0.2, list what moved in progress.md as one line per top-level folder."
- **P1** `[Sonnet/High]`: "Execute P1.1–P1.7 (the KB build), then P1.8–P1.9 (directories). Before writing any scraper, fetch one page and show me the parsed rows. Record all counts in progress.md."
- **P2** `[Sonnet/High]`: "Execute P2. Retrieval must be driven by the KB only: delete every hard-coded product/standard map. Report the eval baseline numbers."
- **P3** `[Sonnet/High]`: "Execute P3. Verify the model ids via the list-models endpoints first. Demo the multi-turn check with the API (curl the SSE output)."
- **P4** `[Sonnet/High]`: "Execute P4. Remove every mock vision output. Test with the real sample photos and paste each response kind and card."
- **P5** `[Sonnet/Med–High]`: "Execute P5. Transcribe Form I field labels exactly from the PDF. Lab and AHC answers must include source and date."
- **P6** `[Sonnet/Med]`: "Execute P6 using the existing chat/v9 components and design tokens. Keep it simple and clean."
- **P7** `[Sonnet/Med]`: "Execute P7. The graph should look and feel like Obsidian's graph view."
- **P8** `[Opus 5.5/XHigh]`: "Run the full-system audit in P8. Report every rule violation from CLAUDE.md with file:line, then fix or hand off to Sonnet."
