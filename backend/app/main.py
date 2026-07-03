from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.routes import dashboard, profile, resume


def create_app() -> FastAPI:
    app = FastAPI(
        title="CareerPilot AI",
        version="0.1.0",
        description="Backend for the CareerPilot AI SaaS platform.",
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
