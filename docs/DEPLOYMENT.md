# Deployment

CareerPilot AI ships as a monorepo: a TanStack Start (SSR) frontend and a
FastAPI backend. This guide covers running the whole stack locally with Docker
and the path to a real deployment. There is **no live deployment yet** — the
steps below are validated up to `docker compose up` working on a laptop.

## Quick start (Docker)

Prereqs: Docker Desktop (or a Docker daemon) and your Gemini API key.

1. **Configure the backend env** — the compose file reads `backend/.env`
   (git-ignored), the same file local dev uses:

   ```bash
   cp backend/.env.example backend/.env
   # paste your GEMINI_API_KEY (free: https://aistudio.google.com/apikey)
   # set JWT_SECRET (see below) if this will be anything but a local demo
   ```

2. **Build and start**:

   ```bash
   docker compose up --build
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000 (health: `GET /health`)

3. **Data persistence** — the SQLite DB and uploaded PDFs live in the
   `careerpilot-data` named volume (mounted at `/app/backend/data`). Schema is
   created/upgraded by Alembic migrations automatically on backend startup.
   To reset to a clean slate: `docker compose down -v`.

4. **Stop** — `docker compose down` (keeps the volume; `-v` also removes it).

## How it fits together

- **Backend container** runs `uvicorn app.main:app`. At boot the app lifespan
  runs `alembic upgrade head`, so the volume gets the current schema with no
  manual step. Every data route requires a JWT (`Authorization: Bearer`).
- **Frontend container** is the same TanStack Start app built with nitro's
  `node-server` preset (the repo's default preset targets Cloudflare Workers;
  the Docker build overrides it). `VITE_API_URL` is baked in at build time to
  `http://localhost:8000/api`, so the browser calls the backend cross-origin
  — the same model as local dev, backed by the backend's CORS config.
- The two containers are linked only by the browser: no internal proxy, no
  host-based networking to reason about.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | for live AI | Free key at Google AI Studio. Empty → local Ollama → deterministic fallback. |
| `JWT_SECRET` | in production | Signs auth tokens. **Must** be a long random string outside dev. |
| `JWT_ALGORITHM` | no | Default `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Default `1440` (24 h). |
| `DATABASE_URL` | no | Defaults to SQLite. Swap to Postgres in prod: `postgresql+psycopg://user:pass@host:5432/careerpilot`. |
| `CORS_ORIGINS` | no | List of allowed browser origins. |

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Production path

There is deliberately **no live deploy** yet (it needs accounts/services you
don't have). When you do ship it, the shape is:

- **Backend**: a container/pod running the `backend/Dockerfile` behind a load
  balancer. Use Postgres (a managed instance or one in the compose file) and
  set a real `JWT_SECRET`. Run `alembic upgrade head` as a deploy step before
  the app starts (the app also runs it idempotently at boot).
- **Frontend**: TanStack Start deploys natively to Cloudflare Workers (the
  project's configured nitro preset). Point `VITE_API_URL` at the deployed
  backend's public URL. This is lighter-weight and cheaper than a Node SSR
  container — the Dockerfile exists for a self-contained local stack.
- **Uploads**: the backend writes PDFs to `data/uploads/` on the local disk
  (or the volume). A production deploy should mount object storage (e.g. an S3
  bucket) at that path.

## Local development (no Docker)

```bash
# backend (from backend/)
backend/venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend (from repo root)
npm run dev   # Vite on http://127.0.0.1:5173
```

`backend/.env` already holds your Gemini key; `src/.env.development` points the
frontend at the backend cross-origin. Schema is handled by the same Alembic
migrations at app startup.
