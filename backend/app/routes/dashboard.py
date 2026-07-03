from fastapi import APIRouter

router = APIRouter(prefix="", tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard() -> dict:
    return {
        "stats": [
            {"label": "Resumes Analyzed", "value": 24, "delta": "+12%"},
            {"label": "Avg ATS Score", "value": 78, "delta": "+4"},
            {"label": "Matched Roles", "value": 142, "delta": "+31"},
        ],
        "activity": [
            {"id": 1, "action": "Resume analyzed", "target": "Alex_Morgan_Resume.pdf"},
        ],
    }
