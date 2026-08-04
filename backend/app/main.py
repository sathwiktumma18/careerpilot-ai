from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  # register ORM models before create_all
from app.config.settings import settings
from app.database.session import Base, engine
from app.routes import dashboard, profile, resume


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Dev-friendly schema bootstrap. Migrations (Alembic) replace this in Phase 3.
    Base.metadata.create_all(bind=engine)
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

    app.include_router(resume.router)
    app.include_router(profile.router)
    app.include_router(dashboard.router)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
