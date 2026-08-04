# CareerPilot AI — backend (FastAPI + Uvicorn)
#
# Schema is created by Alembic migrations in the app lifespan, so no
# migration step is needed here — just start uvicorn. Configuration comes
# entirely from the environment (see backend/.env.example); pass the real
# values via docker-compose (env_file: backend/.env) or your host's env.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so rebuilds after code changes reuse the layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite on a volume (see docker-compose.yml); uploads land in ./data/uploads.
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
