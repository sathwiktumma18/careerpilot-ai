from typing import Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    id: str
    file_name: str


class VersionResponse(BaseModel):
    """A freshly uploaded version (POST /{id}/versions returns this)."""

    id: str
    version_no: int
    file_name: str
    status: str


class VersionInfo(BaseModel):
    """One row in a resume's version history (no analysis payload)."""

    version_no: int
    file_name: str
    status: str
    ats_score: int | None
    created_at: str
    analyzed_at: str | None


class SkillScore(BaseModel):
    name: str
    level: int = Field(ge=0, le=100)


class MissingSkill(BaseModel):
    name: str
    importance: Literal["High", "Medium", "Low"]
    reason: str


class Suggestion(BaseModel):
    title: str
    detail: str
    severity: Literal["high", "medium", "low"]


class RoleMatch(BaseModel):
    role: str
    company: str
    location: str
    match: int = Field(ge=0, le=100)


class TrendPoint(BaseModel):
    month: str
    score: int = Field(ge=0, le=100)


class RadarPoint(BaseModel):
    area: str
    value: int = Field(ge=0, le=100)


class ScoreBreakdown(BaseModel):
    label: str
    score: int = Field(ge=0, le=100)


class Candidate(BaseModel):
    name: str
    title: str
    location: str
    email: str
    years_experience: int = Field(ge=0)


class AnalysisResponse(BaseModel):
    """Full analysis — mirrors the frontend `Analysis` type (snake_case on the wire)."""

    id: str
    file_name: str
    uploaded_at: str
    ats_score: int = Field(ge=0, le=100)
    candidate: Candidate
    summary: str
    score_breakdown: list[ScoreBreakdown]
    detected_skills: list[SkillScore]
    missing_skills: list[MissingSkill]
    suggestions: list[Suggestion]
    recommended_roles: list[RoleMatch]
    keyword_trend: list[TrendPoint]
    skills_radar: list[RadarPoint]


class ResumeListItem(BaseModel):
    """One row on the dashboard/list — group + current version, plus analytics."""

    id: str
    title: str
    file_name: str  # current version's file name
    status: str  # current version's status
    ats_score: int | None  # current version's ATS score
    created_at: str
    version_count: int
    view_count: int
    last_viewed_at: str | None
    first_ats: int | None  # version 1's ATS score, for the trend delta


class ResumeDetail(ResumeListItem):
    current_version_no: int
    versions: list[VersionInfo]
    analysis: AnalysisResponse | None = None
