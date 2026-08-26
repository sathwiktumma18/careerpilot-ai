"""PortfolioAI — the shareable public portfolio page.

Everything here is derived from already-stored resume data (no AI on the
public path), so the page is fast and offline-safe. The slug is deterministic
(see services/portfolio_service.py), so no DB column or migration is needed.
"""
from pydantic import BaseModel, Field

from app.schemas.resume import ScoreBreakdown


class PortfolioSkill(BaseModel):
    name: str
    level: int = Field(ge=0, le=100)


class PortfolioAtsPoint(BaseModel):
    """One point on the portfolio's ATS-history chart (per analyzed version)."""

    version_no: int
    ats_score: int | None
    created_at: str


class PortfolioRole(BaseModel):
    role: str
    company: str
    location: str
    match: int = Field(ge=0, le=100)


class PublicPortfolioResponse(BaseModel):
    slug: str
    name: str
    email: str
    headline: str
    location: str
    years_experience: int = Field(ge=0)
    ats_score: int | None = Field(default=None, ge=0, le=100)
    summary: str
    skills: list[PortfolioSkill]
    ats_history: list[PortfolioAtsPoint]
    score_breakdown: list[ScoreBreakdown]
    recommended_roles: list[PortfolioRole]
    resume_file_name: str
    updated_at: str
    # Phase F — identity from the profile row (both roles).
    is_recruiter: bool = False
    company: str | None = None
    company_role: str | None = None
    avatar_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None


class MyPortfolioResponse(BaseModel):
    """What the app-side manager needs: the user's public path."""

    slug: str
    path: str
