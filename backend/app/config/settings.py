from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven config. See backend/.env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local dev uses SQLite (zero-config). Override with a Postgres URL in prod,
    # e.g. postgresql+psycopg://user:pass@host:5432/careerpilot.
    database_url: str = "sqlite:///./data/careerpilot.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

    environment: str = "development"

    # --- AI providers (free tier) ---
    # Gemini is the primary LLM. Leave GEMINI_API_KEY empty to fall through to
    # Ollama (local), then to the deterministic no-key analyzer.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"

    # Local Ollama fallback.
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # Where uploaded PDFs and the analysis output live (git-ignored).
    upload_dir: str = "./data/uploads"


settings = Settings()
