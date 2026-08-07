# CareerPilot AI

Your AI career copilot: upload a resume, get a real ATS-style analysis, find
matching jobs, rehearse interviews, and follow a personalized career roadmap —
all powered by Google Gemini (free tier) with a local deterministic fallback.

| | |
|---|---|
| **Frontend** | TanStack Start (React 19 + TypeScript), Zustand, Vitest |
| **Backend** | FastAPI + SQLAlchemy 2.0, Pydantic v2, Alembic migrations |
| **Database** | SQLite by default (dev/tests) · Postgres 16 in `docker compose` |
| **AI** | Gemini (`gemini-flash-latest`) → Ollama (local) → deterministic fallback |
| **Auth** | JWT (bcrypt + HS256), ownership-scoped routes, forgot/reset-password |

## Features

- **Resume analysis** — upload a PDF, get an ATS score, section breakdown, and
  recommended roles with suggestions.
- **Job Match** — rank real roles against your resume with Gemini embeddings.
- **Interview Prep** — multi-question sessions with AI feedback per answer.
- **Career Roadmap** — a week-by-week plan to your target role.
- **Auth** — signup / login / forgot-password (one-time reset token, surfaced in
  the response for the demo), with every resume owned and scoped to its user.
- **Dashboard** — aggregate stats across your resumes.

## Quick start

### 1. Local dev (no Docker)

Backend (from `backend/`):

```bash
cp .env.example .env            # paste GEMINI_API_KEY (free, optional but recommended)
python -m venv venv             # or use the existing ./venv
venv/Scripts/python.exe -m pip install -r requirements.txt
venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (from the repo root):

```bash
npm install
npm run dev                     # http://127.0.0.1:5173
```

Migrations run automatically on backend startup.

### 2. Full stack with Docker (includes Postgres)

```bash
cp backend/.env.example backend/.env   # fill in GEMINI_API_KEY
docker compose up --build
```

| Service | URL | Credentials |
| --- | --- | --- |
| Frontend | http://localhost:5173 | — |
| Backend API | http://localhost:8000 | health: `GET /health` |
| Postgres | localhost:5432 | `careerpilot` / `careerpilot` (dev-only) |

Reset everything: `docker compose down -v`.

## Environment variables

Read from `backend/.env` (git-ignored). See `backend/.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | for live AI | Free key at Google AI Studio. Empty → local Ollama → deterministic fallback. |
| `JWT_SECRET` | in production | Signs auth tokens. **Must** be a long random string outside dev. |
| `DATABASE_URL` | no | Defaults to SQLite. `docker compose` uses the in-stack Postgres. |
| `CORS_ORIGINS` | no | Allowed browser origins for the frontend. |

Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Testing

```bash
# backend (66 tests)
cd backend && venv/Scripts/python.exe -m pytest

# frontend (14 tests)
npm test

# frontend static checks
npm run lint
npm run build
```

## Project layout

```
CareerPilot-AI/
├── backend/
│   ├── app/
│   │   ├── config/         # pydantic settings (env-driven)
│   │   ├── database/       # SQLAlchemy engine + session
│   │   ├── models/         # ORM models (User, Resume, …)
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── routes/         # FastAPI routers (auth, resume, match, interview, roadmap)
│   │   └── services/       # business logic + AI providers
│   ├── migrations/         # Alembic migrations
│   └── tests/              # pytest suite (SQLite test DB)
├── src/                    # TanStack Start frontend
│   ├── routes/             # file-based routing
│   ├── services/           # API service layer (talks to the backend)
│   ├── lib/                # stores, analysis logic, mappers
│   └── components/         # UI components
├── docker-compose.yml      # Postgres + backend + frontend
└── docs/DEPLOYMENT.md      # deployment guide
```

## Roadmap

See `TODO.md`. Completed: real Gemini features, full auth + ownership scoping,
Postgres wiring, password reset, Docker stack. Next: PortfolioAI, Recruiter
Dashboard, Phase 4 add-ons, then deploy and online presence.
