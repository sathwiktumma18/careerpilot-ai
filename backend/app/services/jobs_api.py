"""Live job search via JSearch (RapidAPI) — optional, degrades gracefully.

JSearch returns real postings aggregated from job boards (Naukri, Indeed,
Unstop, Google listings, …). Free tier is ≈100 req/mo, so every request goes
through a short in-memory TTL cache keyed on the search tuple, and a missing
key, network error, or rate-limit simply yields `available=False` — callers
fall back to the curated corpus and show a "live jobs unavailable" note.

India prioritization: postings whose `job_country_code` is "IN" (or whose
country string mentions India) sort to the front; the rest follow newest
first. Every posting is capped to `max_age_days` (default 28 = ≤4 weeks).
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

SEARCH_URL = "https://jsearch.p.rapidapi.com/search"

# Keep a request cap for the free tier: cache live results for 30 minutes.
_CACHE_TTL_SECONDS = 30 * 60
_cache: dict[tuple, tuple[float, list["LiveJob"]]] = {}

# India country codes + any location string that mentions India, so local
# postings surface first for a job seeker based in India.
_INDIA_CODES = {"IN", "IND", "356"}


@dataclass(frozen=True)
class LiveJob:
    """A normalized live posting. `salary_*` are None when not advertised."""

    job_id: str
    title: str
    company: str
    location: str
    remote: bool
    salary_min: int | None
    salary_max: int | None
    salary_period: str | None  # "yearly" | "hourly" | None
    apply_link: str | None
    posted_at: str  # ISO-8601 datetime of when the job was posted
    employment_type: str | None  # FULLTIME / PARTTIME / CONTRACT / …
    india: bool


def _parse_utc(value: str) -> datetime | None:
    """Parse JSearch's ISO timestamp (may end in Z or +00:00)."""
    if not value:
        return None
    try:
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def _is_india(item: dict) -> bool:
    code = str(item.get("job_country_code") or "").upper()
    country = str(item.get("job_country") or "")
    return code in _INDIA_CODES or "india" in country.lower()


def _location(item: dict) -> str:
    parts = [p for p in (item.get("job_city"), item.get("job_state")) if p]
    country = item.get("job_country") or ""
    if country and country not in parts:
        parts.append(country)
    if item.get("job_is_remote") or item.get("job_remote"):
        return "Remote" + (f" · {', '.join(parts)}" if parts else "")
    return ", ".join(parts) or "Unknown location"


def _to_int(value) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _normalize(item: dict) -> LiveJob | None:
    posted = _parse_utc(item.get("job_posted_at_datetime_utc") or "")
    if posted is None:
        # No usable date → can't enforce the ≤4-weeks rule; drop it.
        return None
    return LiveJob(
        job_id=str(item.get("job_id") or f"live-{abs(hash(item))}"),
        title=str(item.get("job_title") or "Untitled role").strip(),
        company=str(item.get("employer_name") or "").strip(),
        location=_location(item),
        remote=bool(item.get("job_is_remote") or item.get("job_remote")),
        salary_min=_to_int(item.get("job_min_salary")),
        salary_max=_to_int(item.get("job_max_salary")),
        salary_period=item.get("job_salary_period") or None,
        apply_link=item.get("job_apply_link") or item.get("job_google_link") or None,
        posted_at=posted.isoformat(),
        employment_type=item.get("job_employment_type") or None,
        india=_is_india(item),
    )


def _cached(key: tuple) -> list[LiveJob] | None:
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    if hit:
        _cache.pop(key, None)
    return None


def _posted_ts(posted_at: str) -> float:
    parsed = _parse_utc(posted_at)
    return parsed.timestamp() if parsed else 0.0


async def search_live_jobs(
    query: str,
    *,
    location: str = "",
    remote_only: bool = False,
    limit: int = 10,
) -> tuple[list[LiveJob], bool]:
    """Search live postings. Returns (jobs, available).

    `available=False` means live search is off (no key) or failed — callers
    fall back to the corpus and surface the note. When available, the result
    is capped to postings ≤ `jsearch_max_age_days` old, India-first.
    """
    if not settings.jsearch_api_key:
        return [], False
    if not query.strip():
        return [], True

    key = (query.strip().lower(), location.strip().lower(), remote_only)
    cached = _cached(key)
    if cached is not None:
        return cached, True

    params: dict = {
        "query": f"{query.strip()} {location.strip()}".strip(),
        "page": "1",
        "num_pages": "1",
        # Ask for a month; we still enforce the exact age cutoff client-side.
        "date_posted": "month",
        "job_requirements": "under_3_years_experience,no_degree",
    }
    if remote_only:
        params["remote_jobs_only"] = "true"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                SEARCH_URL,
                params=params,
                headers={
                    "X-RapidAPI-Key": settings.jsearch_api_key,
                    "X-RapidAPI-Host": settings.jsearch_api_host,
                },
            )
        if resp.status_code >= 400:
            logger.warning("JSearch error %s: %s", resp.status_code, resp.text[:200])
            return [], False
        items = resp.json().get("data") or []
    except httpx.HTTPError as exc:
        logger.warning("JSearch unreachable: %s", exc)
        return [], False
    except (ValueError, TypeError):
        logger.warning("JSearch returned non-JSON payload")
        return [], False

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.jsearch_max_age_days)
    jobs: list[LiveJob] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        job = _normalize(item)
        if job is None:
            continue
        posted = _parse_utc(job.posted_at)
        if posted is None or posted < cutoff:
            continue
        if job.job_id in seen:
            continue
        seen.add(job.job_id)
        jobs.append(job)

    # India first, then newest posting. Stable within a tie.
    jobs.sort(key=lambda j: (not j.india, -_posted_ts(j.posted_at)))
    jobs = jobs[:limit]

    if jobs:
        _cache[key] = (time.monotonic(), jobs)
    return jobs, True
