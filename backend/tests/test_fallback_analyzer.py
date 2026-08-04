from app.schemas.resume import AnalysisResponse
from app.services.fallback_analyzer import analyze_resume

from tests.fixtures import SAMPLE_RESUME


def test_analyze_returns_full_schema():
    result = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    assert isinstance(result, AnalysisResponse)
    assert result.id == "r-1"
    assert result.file_name == "jane_doe.pdf"
    assert 25 <= result.ats_score <= 98


def test_detects_actual_skills_from_text():
    result = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    names = [s.name for s in result.detected_skills]
    # Skills literally present in the resume text must be detected.
    for expected in ("React", "Python", "TypeScript", "Docker", "AWS"):
        assert expected in names


def test_missing_skills_are_well_formed():
    result = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    assert len(result.missing_skills) >= 1
    for ms in result.missing_skills:
        assert ms.importance in {"High", "Medium", "Low"}
        assert ms.reason


def test_derives_candidate_and_experience():
    result = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    assert result.candidate.email == "jane.doe@gmail.com"
    assert result.candidate.name == "Jane Doe"
    assert result.candidate.years_experience >= 3


def test_display_series_shapes():
    result = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    assert len(result.score_breakdown) == 5
    assert len(result.skills_radar) == 6
    assert len(result.keyword_trend) == 6
    assert len(result.recommended_roles) == 4
    assert len(result.suggestions) >= 1


def test_deterministic_across_runs():
    a = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    b = analyze_resume("r-1", "jane_doe.pdf", SAMPLE_RESUME)
    assert a.ats_score == b.ats_score
    assert [s.name for s in a.detected_skills] == [s.name for s in b.detected_skills]
