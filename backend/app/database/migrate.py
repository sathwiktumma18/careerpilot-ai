"""Run Alembic migrations programmatically at app startup.

Replaces the old `Base.metadata.create_all` bootstrap: schema now lives in
`migrations/versions/` and is applied by `alembic upgrade head`, which is
idempotent — safe to run on every boot (dev, tests, and Docker alike).
"""
from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def run_migrations() -> None:
    """Upgrade the connected database to the latest migration."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    # Resolve the script location absolutely so the CWD never matters.
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(cfg, "head")
