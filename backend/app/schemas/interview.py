from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Difficulty = Literal["junior", "mid", "senior"]


class InterviewStartRequest(BaseModel):
    resume_id: str | None = None  # Optional — a generic session works without a resume.
    role: str = "Software Engineer"
    difficulty: Difficulty = "mid"
    count: int = Field(default=5, ge=3, le=8)


class InterviewQuestion(BaseModel):
    id: str  # "q1".."qN" within a session
    category: str  # e.g. "Behavioral", "Technical", "System Design"
    text: str
    # What a strong answer should cover — used for fallback scoring.
    evaluation_hints: list[str] = Field(default_factory=list)


class InterviewStartResponse(BaseModel):
    session_id: str
    role: str
    difficulty: Difficulty
    questions: list[InterviewQuestion]


class InterviewFeedbackRequest(BaseModel):
    session_id: str
    question_id: str
    answer: str = Field(min_length=1, max_length=8000)


class InterviewFeedbackResponse(BaseModel):
    # model_answer is a business field, not a pydantic protected namespace.
    model_config = ConfigDict(protected_namespaces=())

    question_id: str
    score: int = Field(ge=0, le=100)
    strengths: list[str]
    improvements: list[str]
    model_answer: str
