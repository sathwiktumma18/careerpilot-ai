from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor filesystem-dependent config to the backend package directory (not the
# process CWD), so the app behaves identically no matter where uvicorn is
# launched from. backend/ is three levels up from this file.
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    """Environment-driven config. See backend/.env.example."""

    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    # Local dev uses SQLite (zero-config). Override with a Postgres URL in prod,
    # e.g. postgresql+psycopg://user:pass@host:5432/careerpilot.
    database_url: str = f"sqlite:///{(DATA_DIR / 'careerpilot.db').as_posix()}"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ]

    environment: str = "development"

    # --- Auth (JWT) ---
    # Override in prod — a leaked/default secret lets anyone forge tokens.
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h (long enough for a demo session)

    # --- Social sign-in (OAuth). Leave unset to disable (endpoints answer 501
    # and the frontend buttons show "coming soon"). Register OAuth apps with
    # redirect URI "{oauth_redirect_base_url}/api/auth/oauth/{provider}/callback".
    oauth_redirect_base_url: str = "http://localhost:8000"
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    # How long the signed OAuth state (authorize → callback) stays valid.
    oauth_state_expire_minutes: int = 10

    # --- AI providers (free tier) ---
    # Gemini is the primary LLM. Leave GEMINI_API_KEY empty to fall through to
    # Ollama (local), then to the deterministic no-key analyzer.
    # gemini-flash-latest is an alias that tracks Google's newest flash model,
    # so it won't be retired out from under a free-tier account.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"
    gemini_embedding_model: str = "gemini-embedding-001"

    # Local Ollama fallback.
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # Where uploaded PDFs and the analysis output live (git-ignored).
    upload_dir: str = str(DATA_DIR / "uploads")


settings = Settings()

# Make sure the on-disk data dirs exist so SQLite can open the DB even on a
# cold start from an arbitrary CWD.
try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
except OSError:
    pass  # Postgres setups don't need local dirs; errors surface at startup.
