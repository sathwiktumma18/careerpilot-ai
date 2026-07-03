from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven config. See backend/.env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://user:pass@localhost:5432/careerpilot"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    openai_api_key: str | None = None
    environment: str = "development"


settings = Settings()
