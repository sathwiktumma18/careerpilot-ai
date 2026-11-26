# CareerPilot AI — FastAPI Backend

FastAPI backend for CareerPilot AI: real Gemini-powered resume analysis, job
matching, interview prep, and career roadmaps, with JWT auth and ownership
scoped routes. Routes, services, models, schemas, and config layers are
separated so AI providers drop in cleanly.

## Quickstart

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Set `VITE_API_URL=http://localhost:8000` in the frontend `.env` to point the
service layer at the local API.

## Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI factory + CORS + router include
│   ├── config/
│   │   └── settings.py      # Pydantic settings (env vars)
│   ├── database/
│   │   └── session.py       # SQLAlchemy engine/session placeholder
│   ├── models/
│   │   └── resume.py        # SQLAlchemy ORM models
│   ├── schemas/
│   │   ├── resume.py        # Pydantic request/response schemas
│   │   └── profile.py
│   ├── routes/
│   │   ├── resume.py        # /upload, /analyze
│   │   ├── profile.py       # /profile
│   │   └── dashboard.py     # /dashboard
│   ├── services/
│   │   └── resume_service.py  # Business logic; wire AI providers here
│   └── utils/
│       └── files.py
└── requirements.txt
```

## Endpoints

| Method | Path                      | Purpose                                     |
| ------ | ------------------------- | ------------------------------------------- |
| POST   | /api/auth/register        | Create an account (returns a JWT)           |
| POST   | /api/auth/login           | Sign in (returns a JWT)                     |
| POST   | /api/auth/forgot-password | Issue a one-time reset token (always 200)   |
| POST   | /api/auth/reset-password  | Set a new password with the token           |
| GET    | /api/auth/me              | Current user                                |
| POST   | /api/resumes              | Upload a resume (PDF)                       |
| GET    | /api/resumes              | List the current user's resumes             |
| POST   | /api/resumes/{id}/analyze | Analyze a resume with Gemini                |
| GET    | /api/resumes/{id}         | Resume detail + analysis                    |
| DELETE | /api/resumes/{id}         | Delete a resume (ownership-scoped)          |
| POST   | /api/match                | Rank jobs against a resume                  |
| GET    | /api/jobs                 | Candidate roles                             |
| POST   | /api/interview/sessions   | Start an interview session                  |
| POST   | /api/interview/feedback   | AI feedback on a single answer              |
| POST   | /api/roadmap              | Generate a career roadmap                   |
| GET    | /api/profile              | Current user profile                        |
| GET    | /api/dashboard            | Aggregated dashboard stats                  |
| GET    | /health                   | Liveness probe (used by Docker healthcheck) |

AI providers live in `services/` (Gemini → Ollama → deterministic fallback).
