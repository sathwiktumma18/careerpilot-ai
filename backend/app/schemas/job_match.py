from typing import Literal

from pydantic import BaseModel, Field


class JobMatchRequest(BaseModel):
    resume_id: str
    # Optional pasted job description to score against the resume. When present,
    # its result is returned first (source="paste"), followed by corpus matches.
    job_description: str = ""
    remote_only: bool = False
    locations: list[str] = Field(default_factory=list)
    limit: int = Field(default=10, ge=1, le=30)


class JobMatchResult(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    remote: bool
    salary_min: int | None
    salary_max: int | None
    match_score: int = Field(ge=0, le=100)
    matched_skills: list[str]
    missing_skills: list[str]
    bonus_skills: list[str]
    summary: str
    source: Literal["corpus", "paste"]


class JobMatchResponse(BaseModel):
    resume_id: str
    resume_title: str
    detected_skills: list[str]
    method: Literal["gemini", "tfidf"]
    results: list[JobMatchResult]


class JobLite(BaseModel):
    """Browse-only view of the corpus (no per-resume match data)."""

    job_id: str
    title: str
    company: str
    location: str
    remote: bool
    salary_min: int
    salary_max: int
    category: str
    skills_count: int
    description: str


class LiveJob(BaseModel):
    """A posting returned from the live JSearch adapter."""

    job_id: str
    title: str
    company: str
    location: str
    remote: bool
    salary_min: int | None
    salary_max: int | None
    salary_period: str | None
    apply_link: str | None
    posted_at: str
    employment_type: str | None
    india: bool


class LiveJobSearchResponse(BaseModel):
    """Result of a live-jobs query.

    `available` is False when the JSearch key is missing or the API failed —
    the frontend then explains that live jobs are off and shows the corpus.
    """

    query: str
    location: str
    jobs: list[LiveJob]
    available: bool
    posted_within_days: int
