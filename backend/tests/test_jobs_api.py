"""JSearch adapter tests — no network.

The adapter's HTTP layer is swapped for a fake client, and the JSearch key is
forced so the code path actually runs (settings default is None → offline).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.config.settings import settings
from app.services import jobs_api

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None):
        self.status_code = status_code
        self._payload = payload
        self.text = ""  # used only in the error path (resp.text[:200])

    def json(self) -> dict:
        return self._payload or {}


class _FakeClient:
    """Async context manager whose .get() returns a canned response."""

    def __init__(self, response: _FakeResponse):
        self._response = response
        self.calls: list[dict] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None, headers=None):
        self.calls.append({"url": url, "params": params, "headers": headers})
        return self._response


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _item(**overrides) -> dict:
    base = {
        "job_id": "job-1",
        "employer_name": "Acme Corp",
        "job_title": "Senior Backend Engineer",
        "job_city": "Bengaluru",
        "job_state": "Karnataka",
        "job_country": "India",
        "job_country_code": "IN",
        "job_remote": False,
        "job_min_salary": 1200000,
        "job_max_salary": 1800000,
        "job_salary_currency": "INR",
        "job_salary_period": "yearly",
        "job_apply_link": "https://acme.com/careers/sr-be",
        "job_google_link": "",
        "job_posted_at_datetime_utc": _iso(datetime.now(timezone.utc) - timedelta(days=3)),
        "job_employment_type": "FULLTIME",
    }
    base.update(overrides)
    return base


@pytest.fixture()
def _fake_jsearch(monkeypatch):
    """Install a fake AsyncClient into the adapter module."""
    responses: list[_FakeResponse] = []
    clients: list[_FakeClient] = []

    def _factory(*_args, **_kwargs):
        client = _FakeClient(responses.pop(0) if responses else _FakeResponse(200, {}))
        clients.append(client)
        return client

    monkeypatch.setattr(jobs_api.httpx, "AsyncClient", _factory)
    monkeypatch.setattr(settings, "jsearch_api_key", "test-key")
    jobs_api._cache.clear()
    return {"responses": responses, "clients": clients}


async def test_no_key_returns_unavailable(_fake_jsearch, monkeypatch):
    monkeypatch.setattr(settings, "jsearch_api_key", None)
    jobs, available = await jobs_api.search_live_jobs("React developer")
    assert available is False
    assert jobs == []


async def test_normalizes_payload(_fake_jsearch):
    _fake_jsearch["responses"].append(
        _FakeResponse(200, {"data": [_item()]})
    )
    jobs, available = await jobs_api.search_live_jobs("Backend engineer")
    assert available is True
    assert len(jobs) == 1
    job = jobs[0]
    assert job.job_id == "job-1"
    assert job.title == "Senior Backend Engineer"
    assert job.company == "Acme Corp"
    assert job.location == "Bengaluru, Karnataka, India"
    assert job.apply_link == "https://acme.com/careers/sr-be"
    assert job.india is True
    assert job.employment_type == "FULLTIME"
    assert not job.remote
    # The date was parsed as an ISO string and round-trips.
    assert jobs_api._parse_utc(job.posted_at) is not None


async def test_drops_postings_older_than_four_weeks(_fake_jsearch):
    _fake_jsearch["responses"].append(
        _FakeResponse(
            200,
            {
                "data": [
                    _item(job_id="fresh", job_posted_at_datetime_utc=_iso(
                        datetime.now(timezone.utc) - timedelta(days=5))),
                    _item(job_id="old", job_posted_at_datetime_utc=_iso(
                        datetime.now(timezone.utc) - timedelta(days=40))),
                ]
            },
        )
    )
    jobs, available = await jobs_api.search_live_jobs("Engineer")
    assert available is True
    assert [j.job_id for j in jobs] == ["fresh"]


async def test_drops_items_without_a_usable_date(_fake_jsearch):
    _fake_jsearch["responses"].append(
        _FakeResponse(200, {"data": [_item(job_id="nodate", job_posted_at_datetime_utc="")]})
    )
    jobs, _ = await jobs_api.search_live_jobs("Engineer")
    assert jobs == []


async def test_india_jobs_sort_first_then_newest(_fake_jsearch):
    now = datetime.now(timezone.utc)
    _fake_jsearch["responses"].append(
        _FakeResponse(
            200,
            {
                "data": [
                    _item(job_id="us-new", job_country="United States", job_country_code="US",
                          job_posted_at_datetime_utc=_iso(now - timedelta(days=1))),
                    _item(job_id="in-older", job_country="India", job_country_code="IN",
                          job_posted_at_datetime_utc=_iso(now - timedelta(days=10))),
                    _item(job_id="in-new", job_country="India", job_country_code="IN",
                          job_posted_at_datetime_utc=_iso(now - timedelta(days=2))),
                ]
            },
        )
    )
    jobs, _ = await jobs_api.search_live_jobs("Engineer")
    # India first (newest India job before the older one), then non-India.
    assert [j.job_id for j in jobs] == ["in-new", "in-older", "us-new"]


async def test_deduplicates_by_job_id(_fake_jsearch):
    _fake_jsearch["responses"].append(
        _FakeResponse(200, {"data": [_item(job_id="dup"), _item(job_id="dup")]})
    )
    jobs, _ = await jobs_api.search_live_jobs("Engineer")
    assert len(jobs) == 1


async def test_api_error_returns_unavailable(_fake_jsearch):
    _fake_jsearch["responses"].append(_FakeResponse(429, {"message": "rate limit"}))
    jobs, available = await jobs_api.search_live_jobs("Engineer")
    assert available is False
    assert jobs == []


async def test_network_error_returns_unavailable(_fake_jsearch, monkeypatch):
    import httpx

    async def _boom(*_a, **_k):
        raise httpx.ConnectError("no route")

    class _Broken:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        get = _boom

    monkeypatch.setattr(jobs_api.httpx, "AsyncClient", lambda *_a, **_k: _Broken())
    jobs, available = await jobs_api.search_live_jobs("Engineer")
    assert available is False
    assert jobs == []


async def test_apply_link_prefers_job_link_over_google_link(_fake_jsearch):
    _fake_jsearch["responses"].append(
        _FakeResponse(
            200,
            {
                "data": [
                    _item(job_apply_link="https://portal.example", job_google_link="https://g.example")
                ]
            },
        )
    )
    jobs, _ = await jobs_api.search_live_jobs("Engineer")
    assert jobs[0].apply_link == "https://portal.example"
