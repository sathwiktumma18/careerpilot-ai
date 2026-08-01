# TODO - CareerPilot-AI

## Phase 0 — Stabilize (DONE)

- [x] Step 0-2: Locate and edit the analysis route to avoid repeated Zustand updates that could freeze rendering.
- [x] Step 3: Analysis runs via Web Worker off the main thread (`analysis-worker.ts`). Build verified; browser smoke-test of runtime stability still pending.
- [x] Step 4: Fixed lint — `endOfLine: "auto"` in `.prettierrc` (Windows CRLF), ESLint ignores Python venvs. `npm run lint` → 0 errors, 6 benign react-refresh warnings.
- [x] Step 5: `npm run build` passes cleanly. No test suite exists yet (no `npm run test` script) — add one in Phase 1.

## Phase 1 — Real AI analysis (NEXT)

- [ ] Parse uploaded PDFs (text extraction)
- [ ] Wire an LLM provider (free tier: Groq / Gemini / Ollama) into `backend/app/services/resume_service.py`
- [ ] Replace frontend `analysis-generator.ts` mock with real backend analysis via `services/api.ts`
- [ ] Add a test suite (vitest) and CI-friendly checks
- [ ] Implement real PDF export for AI reports

## Phase 2 — Feature completion

- [ ] Resume comparison
- [ ] Job Match (embeddings + vector search)
- [ ] AI interview prep
- [ ] Resume rewriting
- [ ] Career roadmaps

## Phase 3 — Production

- [ ] Real auth (tokens, sessions)
- [ ] PostgreSQL persistence + migrations
- [ ] Deployment (Cloudflare workers / VPS)
