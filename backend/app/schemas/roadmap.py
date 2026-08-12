from typing import Literal

from pydantic import BaseModel, Field


class RoadmapRequest(BaseModel):
    resume_id: str | None = None  # Optional — a plan works without a resume.
    target_role: str = Field(default="Software Engineer", min_length=1, max_length=120)
    horizon: int = Field(default=12, ge=4, le=24)  # weeks


class RoadmapMilestone(BaseModel):
    week: int
    title: str
    focus: str  # what to work on that week
    skills: list[str] = Field(default_factory=list)
    deliverable: str  # concrete portfolio output


class RoadmapPhase(BaseModel):
    title: str
    description: str
    week_start: int
    week_end: int
    milestones: list[RoadmapMilestone]


class RoadmapResponse(BaseModel):
    target_role: str
    horizon: int
    summary: str
    target_skills: list[str]
    phases: list[RoadmapPhase]
    generated_by: Literal["gemini", "template"]
    # Set when a typo was corrected: the user's original input, so the UI can
    # show "you typed X → planned for Y". None when no correction happened.
    typed_role: str | None = None
