# CareerPilot AI — Roadmap

## Done

### Phase 0 — Stabilize
- [x] Analysis route de-duplicated (no repeated Zustand updates / render freeze)
- [x] Analysis runs off the main thread via a Web Worker
- [x] Lint clean (0 errors; 6 benign react-refresh warnings), Windows CRLF-safe
- [x] Build passes; test suites added

### Phase 1 — Real AI analysis
- [x] PDF upload + text extraction (PyMuPDF)
- [x] LLM providers wired (Gemini free tier → Ollama → deterministic fallback)
- [x] Real backend analysis served to the frontend via `services/api.ts`
- [x] Vitest + pytest suites and CI-friendly checks

### Phase 2 — Feature completion
- [x] Resume comparison (within analysis)
- [x] Job Match (Gemini embeddings + ranking)
- [x] AI interview prep (sessions + per-answer feedback)
- [x] Resume rewriting (suggestions)
- [x] Career roadmaps (week-by-week plans)

### Phase 3 — Production core
- [x] Full auth: register/login/JWT, ownership-scoped resume routes
- [x] Forgot / reset password (one-time token, no-account-enumeration)
- [x] Postgres wired into `docker compose` (SQLite stays the dev/test path)
- [x] Alembic migrations, run automatically at backend startup
- [x] Docker stack (Postgres + backend + frontend) verified end-to-end

## Next

### Phase 4 — Add-ons
- [ ] Social sign-in (Google/GitHub) — currently a "coming soon" button
- [ ] Resume versioning / history
- [ ] Analytics (per-resume views, match rate over time)

### Phase 5 — PortfolioAI
- [ ] Build a shareable, on-brand personal portfolio / online-presence generator

### Phase 6 — Recruiter Dashboard
- [ ] Recruiter-facing view of candidates, resumes, and match scores

### Phase 7 — Ship
- [ ] Full QA pass (backend + frontend + e2e on the Postgres stack)
- [ ] Deploy (backend to a container host; frontend to Cloudflare Workers or Node SSR)
- [ ] Online presence (portfolio, GitHub, write-ups)
