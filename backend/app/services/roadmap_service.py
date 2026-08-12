"""Career Roadmap — a structured plan from a resume toward a target role.

Gemini generates the plan when a key is present; otherwise a deterministic
template builds a phase-by-week plan from the role's skill gaps. Both paths
return the same RoadmapResponse shape so the UI renders one way.
"""
from __future__ import annotations

import difflib
import json
import logging
import re

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


# --------------------------------------------------------------------------- #
# Typo tolerance (Phase E) — fuzzy-match a misspelled target role onto a track
# --------------------------------------------------------------------------- #

# Canonical role phrases per track. The fuzzy matcher maps input close to one
# of these onto that track, so "frntend engineer" still plans as Frontend.
_ROLE_PHRASES: dict[str, tuple[str, ...]] = {
    "frontend": ("Frontend Engineer", "Frontend Developer", "UI Developer", "React Developer", "Web Developer"),
    "full stack": ("Full Stack Engineer", "Full Stack Developer", "MERN Stack Developer", "MEAN Stack Developer"),
    "backend": ("Backend Engineer", "Backend Developer", "Java Developer", "Python Developer", "Node.js Developer", "API Engineer", "Server Engineer"),
    "devops": ("DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer", "Platform Engineer", "SRE", "Infrastructure Engineer"),
    "data": ("Data Engineer", "Data Analyst", "Analytics Engineer", "Data Scientist", "Database Engineer"),
    "ml": ("Machine Learning Engineer", "ML Engineer", "AI Engineer", "Deep Learning Engineer", "LLM Engineer"),
    "product": ("Product Manager", "Technical Product Manager", "Product Owner", "Program Manager"),
    "design": ("Product Designer", "UX Designer", "UI Designer", "UX/UI Designer", "Design Engineer"),
}

# Minimum confidence before a typo is treated as resolved.
_ROLE_MATCH_THRESHOLD = 0.6


def _normalize_role_text(role: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace — for comparing role names."""
    cleaned = re.sub(r"[^a-z0-9+# .-]", " ", role.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _resolve_role(role: str) -> tuple[str | None, str | None]:
    """Fuzzy-match `role` to a canonical track.

    Returns (canonical_phrase, track_key), or (None, None) when the input maps
    directly to a track by substring (no correction needed) or matches nothing
    confidently. `canonical_phrase` is the cleaned display name to plan for.
    """
    normalized = _normalize_role_text(role)
    if not normalized:
        return None, None

    # Already a known track by substring — the existing behaviour, unchanged.
    if _detect_category(role):
        return None, None

    best_key: str | None = None
    best_phrase: str | None = None
    best_score = 0.0
    for key, phrases in _ROLE_PHRASES.items():
        for phrase in phrases:
            norm = _normalize_role_text(phrase)
            ratio = difflib.SequenceMatcher(None, normalized, norm).ratio()
            # Token overlap catches reordered/"developer vs engineer" phrasing.
            in_tokens = set(normalized.split())
            phrase_tokens = set(norm.split())
            overlap = len(in_tokens & phrase_tokens) / max(len(in_tokens | phrase_tokens), 1)
            score = max(ratio, overlap)
            if score > best_score:
                best_key, best_phrase, best_score = key, phrase, score

    if best_key is not None and best_score >= _ROLE_MATCH_THRESHOLD:
        return best_phrase, best_key
    return None, None


def _gap_skills(role: str, resume_skills: list[str], *, track: str | None = None) -> list[str]:
    """Skills the target role needs that the resume does not yet show.

    `track` overrides the role-derived track (used once a typo has been
    resolved to a canonical role phrase).
    """
    known = {normalize_name(s) for s in resume_skills}
    key = track or _detect_category(role) or ""
    track_skills = _ROLE_SKILLS.get(key, _GENERIC_SKILLS)
    gaps = [s for s in track_skills if normalize_name(s) not in known]
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

    # Typo tolerance: misspellings map onto the closest known role track, and
    # the plan (prompt + gap detection) is built for the corrected role.
    resolved_phrase, resolved_track = _resolve_role(target_role)
    working_role = resolved_phrase or target_role
    gaps = (
        _gap_skills(target_role, resume_skills, track=resolved_track)
        if resolved_track
        else _gap_skills(target_role, resume_skills)
    )

    if settings.gemini_api_key:
        try:
            raw = await ai_provider.generate_text(
                _roadmap_prompt(working_role, resume_skills, gaps, horizon),
                json_mode=True,
                temperature=0.5,
            )
            plan = _parse_roadmap(raw, working_role, horizon)
            return _attach_typed_role(plan, target_role, working_role)
        except (ai_provider.ProviderError, ValueError, json.JSONDecodeError, KeyError, TypeError):
            logger.warning("Gemini roadmap generation failed; using template", exc_info=True)

    plan = _template_roadmap(working_role, gaps, horizon)
    return _attach_typed_role(plan, target_role, working_role)


def _attach_typed_role(plan: RoadmapResponse, typed: str, resolved: str) -> RoadmapResponse:
    """Expose the user's original input when the plan targeted a corrected role."""
    if resolved != typed:
        plan.typed_role = typed
    return plan
