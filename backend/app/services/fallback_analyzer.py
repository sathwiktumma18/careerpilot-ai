"""Deterministic, resume-aware analysis used when no LLM is available.

This is *not* a filename hash — it reads the extracted resume text and computes
genuine signals: skills detected from the catalog, an ATS-style weighted score,
experience from date ranges, quantified impact from bullet content, and
rule-based suggestions. Output shape matches `AnalysisResponse`, so swapping in
a real LLM (ai_provider) is transparent to the rest of the system.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from app.schemas.resume import (
    AnalysisResponse,
    Candidate,
    MissingSkill,
    RadarPoint,
    RoleMatch,
    ScoreBreakdown,
    SkillScore,
    Suggestion,
    TrendPoint,
)
from app.services.skill_catalog import RADAR_AREAS, SKILLS, skills_in_category

# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

_WS = re.compile(r"\s+")


def _norm(text: str) -> str:
    """Collapse all whitespace to single spaces and lowercase (for matching)."""
    return _WS.sub(" ", text).lower()


def _seeded_rng(seed: str):
    h = 2166136261
    for ch in seed:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF

    def rng() -> float:
        nonlocal h
        h = (h + 0x6D2B79F5) & 0xFFFFFFFF
        t = h
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ (t + ((t ^ (t >> 7)) ^ (t >> 15))) * 0x61C88647) & 0xFFFFFFFF
        return (t ^ (t >> 14)) / 4294967296

    return rng


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def _alias_pattern(alias: str) -> str:
    a = alias.strip()
    return rf"(?<!\w)(?:{re.escape(a)})(?!\w)"


def _skill_counts(text: str) -> dict[str, int]:
    """Count catalog skill hits (alias-based, word-boundary matched)."""
    norm = _norm(text)
    counts: dict[str, int] = {}
    for skill in SKILLS:
        pattern = re.compile("|".join(_alias_pattern(a) for a in skill.aliases))
        counts[skill.name] = len(pattern.findall(norm))
    return counts


# --------------------------------------------------------------------------- #
# Structural signals
# --------------------------------------------------------------------------- #

_SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "summary": ("summary", "profile", "objective", "about me"),
    "experience": ("experience", "employment", "work history", "professional background"),
    "education": ("education", "academic", "academics"),
    "skills": ("skills", "technical skills", "core competencies", "technologies", "tech stack"),
    "projects": ("projects", "personal projects", "side projects"),
    "certifications": ("certifications", "certificates", "courses"),
}

_TITLE_KEYWORDS = (
    "engineer", "developer", "architect", "designer", "scientist",
    "analyst", "manager", "lead", "consultant", "specialist", "administrator",
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[A-Za-z.]+")
_YEAR = r"(?:19|20)\d{2}"
_QUANTIFIED_RE = re.compile(
    r"[$\d][\d,.]*(?:%|\$|users|requests|revenue|growth|costs?|uptime|latency|downloads|paying|customers|hours|ms)",
    re.IGNORECASE,
)


def _detect_sections(lines: list[str]) -> dict[str, bool]:
    found: dict[str, bool] = {}
    for line in lines:
        low = _norm(line)
        if not low or len(low) > 48:
            continue
        for section, keywords in _SECTION_KEYWORDS.items():
            if any(kw in low for kw in keywords):
                found[section] = True
    return found


def _years_experience(text: str) -> int:
    current_year = datetime.now().year
    total = 0
    # Matches "2019 - 2020", "2019-2020", "Jun 2019 - Dec 2020", "2021 - Present".
    range_re = re.compile(
        rf"{_YEAR}\s*[-–—to]+\s*(?:[A-Za-z]+\.?\s+)?({_YEAR}|present|current|now)",
        re.IGNORECASE,
    )
    seen: set[tuple[int, int]] = set()
    for m in range_re.finditer(text):
        years = re.findall(rf"{_YEAR}", m.group(0))
        end_present = any(k in m.group(0).lower() for k in ("present", "current", "now"))
        if len(years) >= 2:
            start, end = int(years[0]), int(years[-1])
            span = (start, end)
            if span in seen:
                continue
            seen.add(span)
            total += max(0, min(end - start, 30))
        elif len(years) == 1 and end_present:
            total += max(1, current_year - int(years[0]))
    return min(total, 40)


def _quantified_lines(text: str) -> list[str]:
    return [ln for ln in text.splitlines() if _QUANTIFIED_RE.search(ln)]


def _detect_candidate(text: str, file_name: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    email = ""
    m = _EMAIL_RE.search(text)
    if m:
        email = m.group(0)

    name = ""
    if email:
        name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    if not name and file_name:
        base = re.sub(r"\.[^.]+$", "", file_name).replace("_", " ").replace("-", " ")
        name = base.title()

    title = ""
    for ln in lines[:20]:
        low = ln.lower()
        if any(k in low for k in _TITLE_KEYWORDS) and "@" not in low:
            title = ln[:48]
            break
    if not title:
        title = "Software Engineer"

    location = ""
    # "City, ST / City, Country" style line near the top.
    loc_re = re.compile(r"([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?),\s*([A-Z]{2}|\w+)")
    for ln in lines[:12]:
        m = loc_re.search(ln)
        if m and m.group(1) not in name:
            location = m.group(1) + ", " + m.group(2)
            break

    return {
        "name": name or "Candidate",
        "title": title,
        "location": location,
        "email": email,
        "years_experience": _years_experience(text),
    }


# --------------------------------------------------------------------------- #
# Scores
# --------------------------------------------------------------------------- #

def _compute_scores(*, sections: dict, skill_hits: dict, text: str, years: int) -> dict:
    has = sections.get
    quantified = len(_quantified_lines(text))
    detected_count = sum(1 for c in skill_hits.values() if c > 0)
    word_count = len(text.split())

    formatting = 60
    if has("experience"):
        formatting += 12
    if has("education"):
        formatting += 8
    if has("skills"):
        formatting += 10
    if has("summary"):
        formatting += 5
    if 300 <= word_count <= 1600:
        formatting += 5
    formatting = _clamp(formatting, 30, 98)

    keywords = _clamp(38 + detected_count * 9 + min(6, max(skill_hits.values(), default=0)), 30, 98)
    experience = _clamp(40 + years * 6 + min(12, quantified * 4), 25, 97)
    education = 82 if has("education") else 50
    impact = _clamp(30 + min(45, quantified * 9), 20, 95)

    breakdown = [
        ScoreBreakdown(label="Formatting", score=formatting),
        ScoreBreakdown(label="Keywords", score=keywords),
        ScoreBreakdown(label="Experience", score=experience),
        ScoreBreakdown(label="Education", score=education),
        ScoreBreakdown(label="Impact", score=impact),
    ]
    ats = _clamp(
        round(formatting * 0.15 + keywords * 0.30 + experience * 0.25 + education * 0.10 + impact * 0.20),
        25,
        98,
    )
    return {"ats": ats, "breakdown": breakdown}


# --------------------------------------------------------------------------- #
# Skills
# --------------------------------------------------------------------------- #

def _detected_skills(skill_hits: dict, sections: dict) -> list[SkillScore]:
    in_skills_section = sections.get("skills", False)
    detected = [
        (name, count) for name, count in skill_hits.items() if count > 0
    ]
    detected.sort(key=lambda item: -item[1])
    out: list[SkillScore] = []
    for name, count in detected[:14]:
        level = _clamp(52 + count * 9 + (22 if in_skills_section else 0), 40, 99)
        out.append(SkillScore(name=name, level=level))
    return out


_MISSING_REASON = (
    "Common in the senior roles you target.",
    "Referenced in most matched job posts for your level.",
    "Signals staff-track readiness.",
    "Frequently paired with your strongest skills.",
    "High demand in remote full-stack roles.",
)


def _missing_skills(detected: list[SkillScore]) -> list[MissingSkill]:
    detected_names = {s.name for s in detected}
    missing = [
        s.name for s in SKILLS if s.name not in detected_names
    ]
    # Prioritize by how "senior" the skill reads — a curated ordering.
    priority = [
        "Kubernetes", "AWS", "System Design", "TypeScript", "React", "CI/CD",
        "Docker", "Microservices", "GraphQL", "Redis", "Terraform", "Monitoring",
    ]
    ordered = sorted(
        missing,
        key=lambda n: (priority.index(n) if n in priority else 99),
    )
    out: list[MissingSkill] = []
    for i, name in enumerate(ordered[:6]):
        importance = ("High", "Medium", "Low")[i] if i < 3 else "Low"
        out.append(MissingSkill(name=name, importance=importance, reason=_MISSING_REASON[i % len(_MISSING_REASON)]))
    return out


# --------------------------------------------------------------------------- #
# Suggestions & roles & display series
# --------------------------------------------------------------------------- #

def _suggestions(*, sections: dict, detected_count: int, quantified: int, years: int, text: str) -> list[Suggestion]:
    out: list[Suggestion] = []
    if quantified == 0:
        out.append(Suggestion(
            title="Quantify your impact",
            detail="Add measurable outcomes to your top bullets — revenue lift, latency reduction, or user growth.",
            severity="high",
        ))
    if detected_count < 6:
        out.append(Suggestion(
            title="Expand your skills section",
            detail="List technologies and frameworks explicitly; recruiters and ATS parsers match on these.",
            severity="high",
        ))
    if not sections.get("summary"):
        out.append(Suggestion(
            title="Add a professional summary",
            detail="Three lines at the top: who you are, your top 2 skills, and the scope you operate at.",
            severity="medium",
        ))
    if years >= 5 and not re.search(r"\b(lead|mentor|manager|staff|principal)\b", text, re.IGNORECASE):
        out.append(Suggestion(
            title="Highlight leadership",
            detail="Call out team size, mentorship, and hiring impact — your experience level implies it.",
            severity="medium",
        ))
    if not sections.get("projects"):
        out.append(Suggestion(
            title="Add a projects section",
            detail="Surface 2–3 projects to prove hands-on skill beyond your day job.",
            severity="low",
        ))
    if not out:
        out.append(Suggestion(
            title="Tighten formatting",
            detail="Unify bullet punctuation and use a single date format across all roles.",
            severity="low",
        ))
    return out[:5]


_ROLE_BANK: list[dict] = [
    {"role": "Senior Full-Stack Engineer", "company": "Linear", "location": "Remote", "tags": ["Frontend", "Backend"]},
    {"role": "Staff Software Engineer", "company": "Vercel", "location": "Berlin", "tags": ["Frontend", "Backend", "DevOps"]},
    {"role": "Platform Engineer", "company": "Stripe", "location": "Dublin", "tags": ["Backend", "DevOps"]},
    {"role": "Frontend Engineer", "company": "Figma", "location": "London", "tags": ["Frontend"]},
    {"role": "Backend Engineer", "company": "Supabase", "location": "Remote", "tags": ["Backend", "Data"]},
    {"role": "Site Reliability Engineer", "company": "Cloudflare", "location": "Lisbon", "tags": ["DevOps", "Backend"]},
    {"role": "Machine Learning Engineer", "company": "Hugging Face", "location": "Remote", "tags": ["Data", "Backend"]},
    {"role": "Data Engineer", "company": "Snowflake", "location": "Austin", "tags": ["Data"]},
    {"role": "Product Engineer", "company": "Notion", "location": "Remote", "tags": ["Frontend", "Product"]},
    {"role": "Technical Lead", "company": "Shopify", "location": "Toronto", "tags": ["Backend", "Product"]},
]


def _recommended_roles(skill_hits: dict, ats: int) -> list[RoleMatch]:
    categories = {s.category for s, c in ((skill, skill_hits[skill.name]) for skill in SKILLS) if c > 0}
    scored: list[tuple[int, RoleMatch]] = []
    for bank in _ROLE_BANK:
        tags = set(bank["tags"])
        overlap = len(tags & categories) / max(len(tags), 1)
        match = _clamp(round(66 + overlap * 24 + (ats - 60) * 0.25), 55, 97)
        scored.append((match, RoleMatch(**{**bank, "match": match})))
    scored.sort(key=lambda item: -item[0])
    return [rm for _, rm in scored[:4]]


def _keyword_trend(seed: str, ats: int) -> list[TrendPoint]:
    rng = _seeded_rng(seed + "::trend")
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    out: list[TrendPoint] = []
    base = _clamp(ats - 18, 35, 80)
    for i, month in enumerate(months):
        score = _clamp(base + i * 3 + round((rng() - 0.5) * 8), 30, 99)
        out.append(TrendPoint(month=month, score=score))
    return out


def _skills_radar(skill_hits: dict) -> list[RadarPoint]:
    out: list[RadarPoint] = []
    for area in RADAR_AREAS:
        counts = [skill_hits.get(s, 0) for s in skills_in_category(area)]
        hits = sum(1 for c in counts if c > 0)
        total = sum(counts)
        if hits:
            value = _clamp(round(45 + hits * 12 + min(total, 10) * 2), 40, 99)
        else:
            value = 25  # empty bar communicates the gap
        out.append(RadarPoint(area=area, value=value))
    return out


def _summary(*, title: str, years: int, top_skills: list[str], ats: int) -> str:
    skills = ", ".join(top_skills[:4]) if top_skills else "a strong technical toolkit"
    return (
        f"{title} with {years} year{'s' if years != 1 else ''} of experience, "
        f"strong in {skills}. Profile scores {ats}/100 on ATS-style parsing; "
        "the suggestions below target the biggest interview and keyword gaps."
    )


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def analyze_resume(resume_id: str, file_name: str, text: str) -> AnalysisResponse:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    sections = _detect_sections(lines)
    skill_hits = _skill_counts(text)
    candidate = _detect_candidate(text, file_name)
    years = candidate["years_experience"]

    scores = _compute_scores(
        sections=sections, skill_hits=skill_hits, text=text, years=years
    )
    detected = _detected_skills(skill_hits, sections)
    missing = _missing_skills(detected)
    suggestions = _suggestions(
        sections=sections,
        detected_count=len(detected),
        quantified=len(_quantified_lines(text)),
        years=years,
        text=text,
    )
    roles = _recommended_roles(skill_hits, scores["ats"])
    top_skills = [s.name for s in detected[:4]]

    return AnalysisResponse(
        id=resume_id,
        file_name=file_name,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
        ats_score=scores["ats"],
        candidate=Candidate(**candidate),
        summary=_summary(
            title=candidate["title"], years=years, top_skills=top_skills, ats=scores["ats"]
        ),
        score_breakdown=scores["breakdown"],
        detected_skills=detected,
        missing_skills=missing,
        suggestions=suggestions,
        recommended_roles=roles,
        keyword_trend=_keyword_trend(resume_id, scores["ats"]),
        skills_radar=_skills_radar(skill_hits),
    )
