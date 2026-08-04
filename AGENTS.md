# CareerPilot AI — Agent Guide

Guidance for AI coding agents working in this repo.

## Stack

- **Frontend:** TanStack Start (React 19 + TypeScript) with file-based routing, Tailwind CSS v4, shadcn/ui components, Zustand for state.
- **Backend:** FastAPI + SQLAlchemy under `backend/` (Python venv — do **not** commit or rely on it being present; use `requirements.txt`).
- **Deploy target:** Cloudflare Workers (Nitro build, `cloudflare-module` preset).

## Conventions

- **Route files** live in `src/routes/` — TanStack file-based routing. Dynamic params use `$` (e.g. `resume.analysis.$id.tsx`).
- **UI components** in `src/components/` split into `ui/`, `common/`, `layout/`, `auth/`.
- **State** in `src/lib/store.ts` (Zustand, persisted to localStorage). The `Analysis` type is the domain contract — changing its shape ripples across routes.
- **API seam:** `src/services/api.ts` fronts the backend. Services currently operate on local stores; swap internals to `fetch(BASE_URL + ...)` without changing public signatures.
- **The AI engine is mock.** `src/lib/analysis-generator.ts` is a deterministic placeholder. Real analysis belongs in `backend/app/services/resume_service.py` behind the same `Analysis` shape.

## Quality bar

- `npm run build` and `npm run lint` must stay green before committing.
- Prettier is configured with `endOfLine: "auto"` (Windows CRLF). Do not mass-reformat unrelated files.
- Keep the git history clean: small, focused, meaningful commits.
