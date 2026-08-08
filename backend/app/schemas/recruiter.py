from pydantic import BaseModel, EmailStr


class CandidateSummary(BaseModel):
    """One row in the recruiter's candidate pool."""

    user_id: str
    name: str
    email: EmailStr
    headline: str = ""
    location: str = ""
    ats_score: int | None = None
    resume_id: str | None = None
    resume_title: str | None = None
    searched_roles: list[str] = []
    last_active: str | None = None
    analyzed_count: int = 0
    search_count: int = 0


class CandidateDetail(CandidateSummary):
    summary: str = ""
    skills: list[str] = []


class RecruiterLite(BaseModel):
    """A recruiter as shown on the job seeker's "Recruiters" page."""

    user_id: str
    name: str
    email: EmailStr
    headline: str = ""
    slug: str
    path: str
