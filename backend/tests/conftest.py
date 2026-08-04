"""Test setup.

Forces the no-key fallback analyzer so tests are deterministic and offline,
and isolates the SQLite DB + uploads from the dev data directory.
"""
import os
import sys
from pathlib import Path

# Point the DB at a test file BEFORE the app package is imported (engine is
# built at import time). Uploads also go to a temp dir.
BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DB = BACKEND_DIR / "data" / "test_careerpilot.db"
TEST_DB.parent.mkdir(exist_ok=True)
# Fresh DB every run — the engine is built lazily on first app import.
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["GEMINI_API_KEY"] = ""

sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402

from app.services import ai_provider  # noqa: E402
from app.utils.files import ensure_dir  # noqa: E402


# Re-exported for convenience in test modules.
from tests.fixtures import SAMPLE_RESUME  # noqa: E402, F401


@pytest.fixture(autouse=True)
def _no_live_llm(monkeypatch):
    """Never hit a real LLM in tests — exercise the graceful fallback path."""
    async def _no_llm(*_args, **_kwargs):
        raise ai_provider.ProviderError("forced fallback in tests")

    monkeypatch.setattr(ai_provider, "generate_text", _no_llm)


@pytest.fixture(autouse=True)
def _temp_uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_provider.settings, "upload_dir", str(tmp_path / "uploads"))
    ensure_dir(Path(ai_provider.settings.upload_dir))
    yield
