# CareerPilot AI — FastAPI Backend

Production-ready FastAPI scaffold for CareerPilot AI. Structured for scale:
routes, services, models, schemas, and config layers are separated so AI
integrations (OpenAI, Anthropic, local models) drop in cleanly.

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

| Method | Path         | Purpose                       |
|--------|--------------|-------------------------------|
| POST   | /upload      | Upload a resume (PDF)         |
| POST   | /analyze     | Analyze an uploaded resume    |
| GET    | /profile     | Current user profile          |
| GET    | /dashboard   | Aggregated dashboard stats    |

AI logic is intentionally not implemented — inject providers inside
`services/resume_service.py`.
