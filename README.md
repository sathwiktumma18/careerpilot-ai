# CareerPilot AI

Your AI career copilot: upload a resume, get a real ATS-style analysis, find
matching jobs, rehearse interviews, follow a personalized career roadmap, 
and message recruiters — all powered by Google Gemini with a local 
deterministic fallback.

| | |
|---|---|
| **Frontend** | TanStack Start (React 19 + TypeScript), Zustand, Vitest |
| **Backend** | FastAPI + SQLAlchemy 2.0, Pydantic v2, Alembic migrations |
| **Database** | SQLite by default (dev/tests) · Postgres 16 in `docker compose` |
| **AI** | Gemini (`gemini-flash-latest`) → Ollama (local) → deterministic fallback |
| **Messaging** | Participant-only threads between job seekers and recruiters |
| **Auth** | JWT (bcrypt + HS256), ownership-scoped routes, social sign-in |

## Features

- **Resume analysis** — upload a PDF, get an ATS score, and ATS-optimized recommendations.
- **Messaging** — secure threads between job seekers and recruiters.
- **Recruiter Dashboard** — real-time candidate search, profiles, and management.
- **Career Roadmap** — personalized week-by-week plans.
- **Interview Prep** — multi-question sessions with AI feedback.
- **PortfolioAI** — professional, shareable public portfolio pages.
- **Full Auth** — secure signup/login with social sign-in (Google + GitHub).

## Quick start

### 1. Local dev (no Docker)

Backend (from `backend/`):
```bash
cp .env.example .env            # paste GEMINI_API_KEY
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (from the repo root):
```bash
npm install
npm run dev                     # http://127.0.0.1:5173
```

### 2. Full stack with Docker (includes Postgres)

```bash
cp backend/.env.example backend/.env   # fill in GEMINI_API_KEY
docker compose up --build
```

## Testing

```bash
# Backend tests
cd backend && venv/Scripts/python.exe -m pytest

# Frontend tests
npm test
```

## Project structure

```
CareerPilot-AI/
├── backend/            # FastAPI + SQLAlchemy
├── src/                # TanStack Start Frontend
├── docker-compose.yml  # Full-stack Docker stack
└── docs/               # Deployment guide
```
