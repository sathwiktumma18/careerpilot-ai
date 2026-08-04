from typing import Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    id: str
    file_name: str


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
    id: str
    file_name: str
    status: str
    ats_score: int | None
    created_at: str


class ResumeDetail(ResumeListItem):
    analysis: AnalysisResponse | None = None
