from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database.migrate import run_migrations
from app.routes import auth, dashboard, interview, job_match, oauth, profile, resume, roadmap


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Schema is owned by Alembic migrations; upgrade is idempotent.
    run_migrations()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="CareerPilot AI",
        version="0.1.0",
        description="Backend for the CareerPilot AI SaaS platform.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(oauth.router)
    app.include_router(resume.router)
    app.include_router(profile.router)
    app.include_router(dashboard.router)
    app.include_router(job_match.router)
    app.include_router(interview.router)
    app.include_router(roadmap.router)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
