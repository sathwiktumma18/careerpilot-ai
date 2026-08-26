"""PortfolioAI — build the shareable public portfolio from stored data.

The public page is read-only and needs **no AI**: everything comes from the
analysis JSON already saved on resume versions, so it's fast and offline-safe.
The slug is derived deterministically from the user's email local-part
(fallback: name), so no DB column or migration is required.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.user import ROLE_RECRUITER, User
from app.schemas.portfolio import (
    PortfolioAtsPoint,
    PortfolioRole,
    PortfolioSkill,
    PublicPortfolioResponse,
)
from app.schemas.resume import ScoreBreakdown
from app.services.resume_service import resume_service


def _slugify(value: str) -> str:
    """Lowercase, keep [a-z0-9], collapse runs of other chars into dashes."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "user"


def slugify(user: User) -> str:
    """Base slug from the email local-part, else the name."""
    local = user.email.split("@", 1)[0] if "@" in user.email else user.email
    base = _slugify(local)
    return base if base and base != "user" else _slugify(user.name) or "user"


def _slug_map(db: Session) -> dict[str, User]:
    """Slug → user, resolving same-local-part collisions with -2/-3/… suffixes.

    Order matters: the earliest-created account keeps the bare slug and later
    ones get a numeric suffix. Deterministic for a given DB contents.
    """
    users = list(db.scalars(select(User).order_by(User.created_at)))
    counts: dict[str, int] = {}
    result: dict[str, User] = {}
    for u in users:
        base = slugify(u)
        n = counts.get(base, 0)
        counts[base] = n + 1
        slug = base if n == 0 else f"{base}-{n + 1}"
        result[slug] = u
    return result


def derive_slug(db: Session, user: User) -> str:
    """The exact slug a user's public page lives at (matching `/public/portfolio`)."""
    for slug, u in _slug_map(db).items():
        if u.id == user.id:
            return slug
    return slugify(user)


def get_user_by_slug(db: Session, slug: str) -> User | None:
    """Resolve a slug to its owner. O(n) over a small user set."""
    return _slug_map(db).get(slug.lower())


def _primary_resume(resumes: list[Resume]) -> Resume | None:
    """The resume the portfolio headlines: highest-ATS analyzed, else newest."""
    if not resumes:
        return None
    analyzed = [
        r for r in resumes
        if r.current_version and r.current_version.ats_score is not None
    ]
    if analyzed:
        return max(analyzed, key=lambda r: r.current_version.ats_score)
    return max(resumes, key=lambda r: r.created_at)


def _maybe_score_breakdown(value) -> list[ScoreBreakdown]:
    rows = value if isinstance(value, list) else []
    out: list[ScoreBreakdown] = []
    for row in rows[:10]:
        if isinstance(row, dict) and "label" in row:
            try:
                out.append(ScoreBreakdown(label=str(row["label"]), score=int(row.get("score", 0))))
            except (TypeError, ValueError):
                continue
    return out


def _maybe_roles(value) -> list[PortfolioRole]:
    rows = value if isinstance(value, list) else []
    out: list[PortfolioRole] = []
    for row in rows[:3]:
        if isinstance(row, dict) and "role" in row:
            try:
                out.append(
                    PortfolioRole(
                        role=str(row["role"]),
                        company=str(row.get("company", "")),
                        location=str(row.get("location", "")),
                        match=int(row.get("match", 0)),
                    )
                )
            except (TypeError, ValueError):
                continue
    return out


def _profile_row(db: Session, user: User):
    """The user's 1:1 profile row (None when never saved — fields default empty)."""
    from app.models.profile import Profile

    return db.get(Profile, user.id)


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def build_public_portfolio(db: Session, user: User) -> PublicPortfolioResponse:
    """Assemble the public page. Never calls the LLM.

    Job seekers get the resume-derived page (skills, ATS history) with their
    editable profile identity layered on top. Recruiters get a page built
    entirely from their profile row — company / role / location / bio / contact
    — since they have no resumes.
    """
    profile = _profile_row(db, user)
    avatar_url = None
    if profile and profile.avatar_path:
        avatar_url = f"/api/public/avatar/{user.id}"
    linkedin = _clean(profile.linkedin_url) if profile else None
    github = _clean(profile.github_url) if profile else None
    portfolio_url = _clean(profile.portfolio_url) if profile else None
    company = _clean(profile.company) if profile else None
    company_role = _clean(profile.company_role) if profile else None
    prof_location = _clean(profile.location) if profile else None
    prof_bio = _clean(profile.bio) if profile else None
    prof_headline = _clean(profile.headline) if profile else None

    if user.role == ROLE_RECRUITER:
        # Recruiters have no resume data — the profile IS the portfolio.
        headline = prof_headline or (
            f"{company_role} at {company}" if company_role and company else (company_role or company or "")
        )
        return PublicPortfolioResponse(
            slug=derive_slug(db, user),
            name=user.name,
            email=user.email,
            headline=headline,
            location=prof_location or "",
            years_experience=(profile.years_experience or 0) if profile else 0,
            ats_score=None,
            summary=prof_bio or "",
            skills=[],
            ats_history=[],
            score_breakdown=[],
            recommended_roles=[],
            resume_file_name="",
            updated_at=(profile.updated_at.isoformat() if profile else user.created_at.isoformat()),
            is_recruiter=True,
            company=company,
            company_role=company_role,
            avatar_url=avatar_url,
            linkedin_url=linkedin,
            github_url=github,
            portfolio_url=portfolio_url,
        )

    resumes = resume_service.list_owned(db, user.id)
    resume = _primary_resume(resumes)
    cv = resume.current_version if resume else None
    analysis = cv.analysis if cv and cv.analysis else None
    candidate = analysis.get("candidate") if isinstance(analysis, dict) else {}

    skills = []
    if isinstance(analysis, dict):
        detected = analysis.get("detected_skills") or []
        for s in detected[:8]:
            if isinstance(s, dict) and s.get("name"):
                try:
                    skills.append(PortfolioSkill(name=str(s["name"]), level=int(s.get("level", 50))))
                except (TypeError, ValueError):
                    continue

    ats_history = [
        PortfolioAtsPoint(
            version_no=v.version_no,
            ats_score=v.ats_score,
            created_at=v.created_at.isoformat(),
        )
        for v in (resume.versions if resume else [])
        if v.ats_score is not None
    ]

    updated = None
    if resume:
        analyzed = [v.analyzed_at for v in resume.versions if v.analyzed_at]
        updated = max(analyzed) if analyzed else resume.created_at
    if profile and (updated is None or profile.updated_at > updated):
        updated = profile.updated_at

    return PublicPortfolioResponse(
        slug=derive_slug(db, user),
        name=user.name,
        email=user.email,
        # Profile identity wins; resume analysis fills the gaps.
        headline=prof_headline
        or (str(candidate.get("title") or "") if isinstance(candidate, dict) else ""),
        location=prof_location
        or (str(candidate.get("location") or "") if isinstance(candidate, dict) else ""),
        years_experience=(profile.years_experience or 0)
        if profile
        else (int(candidate.get("years_experience") or 0) if isinstance(candidate, dict) else 0),
        ats_score=cv.ats_score if cv else None,
        summary=prof_bio or (str(analysis.get("summary") or "") if isinstance(analysis, dict) else ""),
        skills=skills,
        ats_history=ats_history,
        score_breakdown=_maybe_score_breakdown(analysis.get("score_breakdown")) if isinstance(analysis, dict) else [],
        recommended_roles=_maybe_roles(analysis.get("recommended_roles")) if isinstance(analysis, dict) else [],
        resume_file_name=cv.file_name if cv else "",
        updated_at=updated.isoformat() if updated else user.created_at.isoformat(),
        is_recruiter=False,
        company=company,
        company_role=company_role,
        avatar_url=avatar_url,
        linkedin_url=linkedin,
        github_url=github,
        portfolio_url=portfolio_url,
    )
