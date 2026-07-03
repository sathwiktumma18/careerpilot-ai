"""Resume analysis service. Inject AI providers here (OpenAI, Anthropic, etc.)."""
from uuid import uuid4

from app.schemas.resume import AnalysisResponse, SkillScore


class ResumeService:
    async def register_upload(self, file_name: str) -> dict:
        return {"id": str(uuid4()), "file_name": file_name}

    async def analyze(self, resume_id: str) -> AnalysisResponse:
        # TODO: call AI provider, parse PDF, run scoring pipeline
        return AnalysisResponse(
            id=resume_id,
            ats_score=82,
            summary="Placeholder analysis. Wire an AI provider in ResumeService.analyze().",
            detected_skills=[
                SkillScore(name="React", level=95),
                SkillScore(name="TypeScript", level=92),
                SkillScore(name="Node.js", level=88),
            ],
            missing_skills=["Kubernetes", "Terraform", "System Design"],
            suggestions=[
                "Quantify impact with metrics",
                "Front-load senior keywords",
                "Trim early-career experience",
            ],
        )


resume_service = ResumeService()
