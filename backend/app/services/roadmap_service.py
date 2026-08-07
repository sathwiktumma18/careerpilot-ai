"""Career Roadmap — a structured plan from a resume toward a target role.

Gemini generates the plan when a key is present; otherwise a deterministic
template builds a phase-by-week plan from the role's skill gaps. Both paths
return the same RoadmapResponse shape so the UI renders one way.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.schemas.roadmap import RoadmapMilestone, RoadmapPhase, RoadmapResponse
from app.services import ai_provider
from app.services.resume_service import resume_service
from app.services.skill_catalog import normalize_name

logger = logging.getLogger(__name__)

# Skills a given role needs — used to detect gaps vs the resume and to seed the
# template fallback. Role detection is substring-based, so "Senior Frontend
# Engineer" matches "frontend".
_ROLE_SKILLS: dict[str, list[str]] = {
    "frontend": ["React", "TypeScript", "Tailwind CSS", "Testing", "GraphQL", "Accessibility"],
    "full stack": ["React", "TypeScript", "Node.js", "SQL", "Docker", "Cloud"],
    "backend": ["Python", "SQL", "Docker", "Redis", "PostgreSQL", "System Design"],
    "devops": ["Linux", "Docker", "Kubernetes", "CI/CD", "Terraform", "Observability"],
    "platform": ["Linux", "Docker", "Kubernetes", "CI/CD", "Terraform", "Observability"],
    "sre": ["Linux", "Docker", "Kubernetes", "CI/CD", "Terraform", "Observability"],
    "data": ["Python", "SQL", "Statistics", "Machine Learning", "ETL", "Data Visualization"],
    "ml": ["Python", "Machine Learning", "Deep Learning", "MLOps", "SQL", "Docker"],
    "product": ["Discovery", "Metrics", "Prioritization", "Experimentation", "Roadmapping", "Stakeholders"],
    "design": ["Figma", "User Research", "UI Design", "Prototyping", "Accessibility", "Design Systems"],
}

_GENERIC_SKILLS = ["Python", "SQL", "System Design", "Testing", "Version Control", "Communication"]

_MAX_GAP_SKILLS = 6


def _detect_category(role: str) -> str | None:
    """Map a role title to the closest skills track, or None for generic."""
    lowered = role.lower()
    # "full stack" before "frontend"/"backend" so it wins when both appear.
    for key in ("full stack", "frontend", "backend", "devops", "platform", "sre", "ml", "data", "product", "design"):
        if key in lowered:
            return key
    return None


def _gap_skills(role: str, resume_skills: list[str]) -> list[str]:
    """Skills the target role needs that the resume does not yet show."""
    known = {normalize_name(s) for s in resume_skills}
    track = _ROLE_SKILLS.get(_detect_category(role) or "", _GENERIC_SKILLS)
    gaps = [s for s in track if normalize_name(s) not in known]
    return gaps[:_MAX_GAP_SKILLS]


# --------------------------------------------------------------------------- #
# Deterministic template fallback
# --------------------------------------------------------------------------- #

def _week_template(week: int, horizon: int, skill: str) -> tuple[str, str, str]:
    """(title, focus, deliverable) for one week, staged by progress."""
    frac = week / max(horizon, 1)
    if frac <= 0.4:
        return (
            f"Learn the fundamentals of {skill}",
            f"Build the mental model: docs, one course module, and a minimal working example that uses {skill}.",
            f"A small exercise or notes demonstrating {skill}.",
        )
    if frac <= 0.75:
        return (
            f"Apply {skill} in a real project",
            f"Use {skill} inside a portfolio project alongside the strengths your resume already shows.",
            "A committed feature or PR that ships and is easy to explain.",
        )
    return (
        f"Prove {skill} on your profile",
        f"Refactor, document, and showcase {skill} with measurable outcomes.",
        "A case-study write-up for your resume and portfolio.",
    )


def _template_roadmap(role: str, gap_skills: list[str], horizon: int) -> RoadmapResponse:
    skills = gap_skills or ["Core skills"]
    milestones = [
        RoadmapMilestone(
            week=week,
            title=title,
            focus=focus,
            skills=[skill],
            deliverable=deliverable,
        )
        for week, skill in ((w, skills[(w - 1) % len(skills)]) for w in range(1, horizon + 1))
        for title, focus, deliverable in [_week_template(week, horizon, skill)]
    ]

    cuts = [round(horizon * 0.4), round(horizon * 0.75), horizon]
    phase_meta = [
        ("Foundation", "Master the core skills behind the role"),
        ("Core build", "Apply them in a portfolio project"),
        ("Launch", "Turn the work into interview evidence"),
    ]
    phases: list[RoadmapPhase] = []
    start = 1
    for (title, description), end in zip(phase_meta, cuts):
        chunk = [m for m in milestones if start <= m.week <= end]
        if chunk:
            phases.append(
                RoadmapPhase(
                    title=title,
                    description=description,
                    week_start=start,
                    week_end=end,
                    milestones=chunk,
                )
            )
        start = end + 1

    target = list(dict.fromkeys(skills))  # dedupe, preserve order
    return RoadmapResponse(
        target_role=role,
        horizon=horizon,
        summary=(
            f"A {horizon}-week plan to reach \"{role}\", focused on the {len(target)} "
            f"skills ({', '.join(target)}) that matter most for the role."
        ),
        target_skills=target,
        phases=phases,
        generated_by="template",
    )


# --------------------------------------------------------------------------- #
# Gemini generation
# --------------------------------------------------------------------------- #

def _roadmap_prompt(role: str, resume_skills: list[str], gap_skills: list[str], horizon: int) -> str:
    have = ", ".join(resume_skills) if resume_skills else "(none detected)"
    gaps = ", ".join(gap_skills) if gap_skills else "(decide from the role)"
    return f"""You are a senior career coach. Build a {horizon}-week career roadmap to reach the role "{role}".

The candidate's resume currently shows these skills: {have}.
Suggested gap areas to focus on: {gaps}.

Return ONLY valid JSON matching this EXACT schema:
{{"summary": "one paragraph", "target_skills": ["4-8 skill names"], "phases": [{{"title": "phase name", "description": "one line", "milestones": [{{"week": 1, "title": "week title", "focus": "what to do this week", "skills": ["1-2 skills"], "deliverable": "concrete output (project/PR/write-up)"}}]}}]}}

Rules:
- Exactly {horizon} milestones total, weeks numbered 1..{horizon} across phases; phases cover contiguous week ranges.
- One milestone per week; be concrete and actionable.
- Don't re-teach what the resume already covers — push the gaps.
No markdown, no extra fields."""


def _parse_roadmap(raw: str, role: str, horizon: int) -> RoadmapResponse:
    data = ai_provider._extract_json(raw)
    phases_raw = data.get("phases", [])
    if not phases_raw:
        raise ValueError("No phases in roadmap response")

    phases: list[RoadmapPhase] = []
    total_weeks = 0
    for p in phases_raw:
        milestones = [
            RoadmapMilestone(
                week=int(m.get("week", 0)),
                title=str(m.get("title", "")).strip(),
                focus=str(m.get("focus", "")),
                skills=[str(s) for s in m.get("skills", [])][:3],
                deliverable=str(m.get("deliverable", "")),
            )
            for m in p.get("milestones", [])
            if m.get("week") is not None
        ]
        if not milestones:
            continue
        weeks = [m.week for m in milestones]
        phases.append(
            RoadmapPhase(
                title=str(p.get("title", "")).strip(),
                description=str(p.get("description", "")),
                week_start=min(weeks),
                week_end=max(weeks),
                milestones=milestones,
            )
        )
        total_weeks += len(milestones)

    if total_weeks != horizon:
        raise ValueError(f"Expected {horizon} milestones, got {total_weeks}")

    target = [str(s) for s in data.get("target_skills", [])][:8]
    return RoadmapResponse(
        target_role=role,
        horizon=horizon,
        summary=str(data.get("summary", "")),
        target_skills=target or phases[0].milestones[0].skills,
        phases=phases,
        generated_by="gemini",
    )


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

async def generate_roadmap(
    db: Session,
    *,
    resume_id: str | None = None,
    target_role: str = "Software Engineer",
    horizon: int = 12,
    user_id: str | None = None,
) -> RoadmapResponse:
    resume_skills: list[str] = []
    # Only the owner's resume may shape the plan — someone else's id is treated
    # as "no resume" so it can't leak skill data.
    if resume_id and user_id:
        resume = resume_service.get_owned_or_none(db, resume_id, user_id)
        cv = resume.current_version if resume else None
        if cv and cv.analysis:
            resume_skills = [s["name"] for s in cv.analysis.get("detected_skills", [])]

    gaps = _gap_skills(target_role, resume_skills)

    if settings.gemini_api_key:
        try:
            raw = await ai_provider.generate_text(
                _roadmap_prompt(target_role, resume_skills, gaps, horizon),
                json_mode=True,
                temperature=0.5,
            )
            return _parse_roadmap(raw, target_role, horizon)
        except (ai_provider.ProviderError, ValueError, json.JSONDecodeError, KeyError, TypeError):
            logger.warning("Gemini roadmap generation failed; using template", exc_info=True)

    return _template_roadmap(target_role, gaps, horizon)
