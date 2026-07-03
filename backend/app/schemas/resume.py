from pydantic import BaseModel


class UploadResponse(BaseModel):
    id: str
    file_name: str


class SkillScore(BaseModel):
    name: str
    level: int


class AnalysisResponse(BaseModel):
    id: str
    ats_score: int
    summary: str
    detected_skills: list[SkillScore]
    missing_skills: list[str]
    suggestions: list[str]
