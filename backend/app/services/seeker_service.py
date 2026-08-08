"""Seeker activity + the recruiter candidate pool.

Every job-seeker product action (resume analyzed, job searched) writes a
`SeekerActivity` row. Recruiters query those rows to see the candidates who are
actively using the platform — their profile, resume, ATS score, the roles they
searched, and when they were last active.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.seeker_activity import SeekerActivity
from app.models.user import ROLE_JOB_SEEKER, ROLE_RECRUITER, User
from app.services.portfolio_service import derive_slug
from app.services.resume_service import resume_service

ACTIVITY_RESUME_ANALYZED = "resume_analyzed"
ACTIVITY_JOB_SEARCHED = "job_searched"


def role_from_analysis(analysis: dict) -> str:
    """Best label for a fresh analysis: its top recommended role, else the
    resume's headline candidate title, else a generic label."""
    roles = analysis.get("recommended_roles") or []
    if roles and isinstance(roles[0], dict) and roles[0].get("role"):
        return str(roles[0]["role"])
    candidate = analysis.get("candidate") or {}
    if isinstance(candidate, dict) and candidate.get("title"):
        return str(candidate["title"])
    return "Resume analysis"


def record_activity(
    db: Session, *, user_id: str, activity_type: str, role: str = "", detail: str | None = None
) -> None:
    """Write one activity row. Only job seekers count toward the candidate pool
    (recruiters have no resume-analysis flow anyway, but stay defensive)."""
    user = db.get(User, user_id)
    if user is None or user.role != ROLE_JOB_SEEKER:
        return
    db.add(
        SeekerActivity(user_id=user_id, activity_type=activity_type, role=role, detail=detail)
    )
    db.commit()


def _primary_resume(db: Session, user_id: str) -> Resume | None:
    """The resume that best represents the seeker: highest-ATS analyzed, else
    the newest (mirrors the public portfolio's pick)."""
    resumes = resume_service.list_owned(db, user_id)
    analyzed = [
        r for r in resumes
        if r.current_version and r.current_version.ats_score is not None
    ]
    if analyzed:
        return max(analyzed, key=lambda r: r.current_version.ats_score)
    return max(resumes, key=lambda r: r.created_at) if resumes else None


def _searched_roles(activities: list[SeekerActivity]) -> list[str]:
    """Distinct roles the seeker searched for, most recent first."""
    roles: list[str] = []
    for a in activities:
        if a.activity_type == ACTIVITY_JOB_SEARCHED and a.role and a.role not in roles:
            roles.append(a.role)
    return roles


def _build_candidate(
    db: Session, user: User, activities: list[SeekerActivity], *, include_detail: bool = False
) -> dict:
    resume = _primary_resume(db, user.id)
    cv = resume.current_version if resume else None
    analysis = cv.analysis if cv and cv.analysis else None
    candidate = analysis.get("candidate") if isinstance(analysis, dict) else {}

    item = {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "headline": str(candidate.get("title") or "") if isinstance(candidate, dict) else "",
        "location": str(candidate.get("location") or "") if isinstance(candidate, dict) else "",
        "ats_score": cv.ats_score if cv else None,
        "resume_id": resume.id if resume else None,
        "resume_title": resume.title if resume else None,
        "searched_roles": _searched_roles(activities),
        "last_active": activities[0].created_at.isoformat(),
        "analyzed_count": sum(
            1 for a in activities if a.activity_type == ACTIVITY_RESUME_ANALYZED
        ),
        "search_count": sum(1 for a in activities if a.activity_type == ACTIVITY_JOB_SEARCHED),
    }
    if include_detail:
        item["summary"] = (
            str(analysis.get("summary") or "") if isinstance(analysis, dict) else ""
        )
        item["skills"] = [
            str(s["name"])
            for s in (analysis.get("detected_skills") or [])
            if isinstance(s, dict) and s.get("name")
        ][:12]
    return item


def _activities_for(db: Session, user_id: str) -> list[SeekerActivity]:
    return list(
        db.scalars(
            select(SeekerActivity)
            .where(SeekerActivity.user_id == user_id)
            .order_by(SeekerActivity.created_at.desc())
        )
    )


def list_candidates(db: Session) -> list[dict]:
    """Job seekers with at least one activity, newest-active first."""
    seekers = db.scalars(
        select(User).where(User.role == ROLE_JOB_SEEKER).order_by(User.created_at)
    ).all()
    out = []
    for user in seekers:
        activities = _activities_for(db, user.id)
        if not activities:
            continue
        out.append(_build_candidate(db, user, activities))
    out.sort(key=lambda c: c["last_active"] or "", reverse=True)
    return out


def get_candidate(db: Session, user_id: str) -> dict | None:
    """Full candidate detail (adds summary + skills), or None if the user has no
    activity (not a candidate) — recruiters only ever see active seekers."""
    user = db.get(User, user_id)
    if user is None or user.role != ROLE_JOB_SEEKER:
        return None
    activities = _activities_for(db, user.id)
    if not activities:
        return None
    return _build_candidate(db, user, activities, include_detail=True)


def list_recruiters(db: Session) -> list[dict]:
    """All recruiter accounts — the page job seekers use to find + message them."""
    recruiters = db.scalars(
        select(User).where(User.role == ROLE_RECRUITER).order_by(User.created_at)
    ).all()
    out = []
    for r in recruiters:
        slug = derive_slug(db, r)
        out.append(
            {
                "user_id": r.id,
                "name": r.name,
                "email": r.email,
                "slug": slug,
                "path": f"/p/{slug}",
                # Recruiters have no resume analysis; Phase F adds real profile
                # fields (company/title/bio) that fill this headline in.
                "headline": "",
            }
        )
    return out
