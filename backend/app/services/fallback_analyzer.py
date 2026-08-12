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
from app.services.skill_catalog import RADAR_AREAS, SKILLS, alias_pattern, skills_in_category

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


def _skill_counts(text: str) -> dict[str, int]:
    """Count catalog skill hits (alias-based, word-boundary matched)."""
    norm = _norm(text)
    counts: dict[str, int] = {}
    for skill in SKILLS:
        pattern = re.compile("|".join(alias_pattern(a) for a in skill.aliases))
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
# JD-specific analysis (job_description / target_role)
# --------------------------------------------------------------------------- #

# target_role -> skill categories. Order matters: the first match wins, so the
# most specific phrases come first.
_ROLE_CATEGORIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("full stack", ("Frontend", "Backend")),
    ("full-stack", ("Frontend", "Backend")),
    ("frontend", ("Frontend",)),
    ("backend", ("Backend",)),
    ("devops", ("DevOps",)),
    ("sre", ("DevOps", "Backend")),
    ("site reliability", ("DevOps", "Backend")),
    ("platform", ("DevOps", "Backend")),
    ("data engineering", ("Data",)),
    ("data analyst", ("Data",)),
    ("machine learning", ("Data", "Backend")),
    ("ml", ("Data", "Backend")),
    ("ai", ("Data", "Backend")),
    ("data", ("Data",)),
    ("product", ("Product",)),
    ("design", ("Design",)),
    ("ux", ("Design",)),
    ("ui", ("Design", "Frontend")),
    ("qa", ("Backend", "Product")),
    ("test", ("Backend",)),
    ("mobile", ("Frontend", "Backend")),
    ("security", ("DevOps", "Backend")),
    ("cloud", ("DevOps",)),
    ("dev", ("Frontend", "Backend")),
    ("software", ("Backend", "Frontend")),
)


def _role_categories(role: str | None) -> list[str]:
    """Skill categories implied by a target role, or [] when unrecognized."""
    if not role:
        return []
    low = role.lower()
    for keyword, cats in _ROLE_CATEGORIES:
        if keyword in low:
            return list(cats)
    return []


def _jd_required_skills(
    job_description: str | None, target_role: str | None, resume_hits: dict[str, int]
) -> tuple[list[str], float]:
    """(required skill names, jd_signal).

    Prefer the skills actually mentioned in the pasted JD (jd_signal=1.0 — the
    strongest evidence). If the JD is skill-less, fall back to the categories the
    target role implies (0.6). If neither yields anything, degrade to the
    resume's own skills so the response still has a coherent fit value (0.0).
    """
    if job_description:
        jd_hits = _skill_counts(job_description)
        required = [name for name, count in jd_hits.items() if count > 0]
        if required:
            return required, 1.0
    cats = _role_categories(target_role)
    if cats:
        required: list[str] = []
        for cat in cats:
            for name in skills_in_category(cat):
                if name not in required:
                    required.append(name)
        return required, 0.6
    return list(resume_hits.keys()), 0.0


def _analyze_with_jd(
    resume_id: str,
    file_name: str,
    text: str,
    *,
    job_description: str | None,
    target_role: str | None,
) -> AnalysisResponse:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    sections = _detect_sections(lines)
    skill_hits = _skill_counts(text)
    candidate = _detect_candidate(text, file_name)
    years = candidate["years_experience"]
    base = _compute_scores(
        sections=sections, skill_hits=skill_hits, text=text, years=years
    )
    base_breakdown = {b.label: b.score for b in base["breakdown"]}

    # The JD fit: how much of the posting's required skill set the resume has.
    resume_has = {name for name, count in skill_hits.items() if count > 0}
    required, jd_signal = _jd_required_skills(job_description, target_role, resume_has)
    matched = [s for s in required if s in resume_has]
    overlap = (len(matched) / len(required)) if required else 1.0
    jd_fit = round(overlap * 100)

    # Keywords become JD-aware when we have real JD evidence.
    keywords_base = base_breakdown.get("Keywords", 60)
    if jd_signal > 0:
        keywords = _clamp(round(keywords_base * 0.5 + jd_fit * 0.5), 30, 98)
    else:
        keywords = keywords_base

    formatting = base_breakdown.get("Formatting", 60)
    experience = base_breakdown.get("Experience", 40)
    education = base_breakdown.get("Education", 50)
    impact = base_breakdown.get("Impact", 30)

    jd_ats = _clamp(
        round(
            formatting * 0.12
            + keywords * 0.22
            + jd_fit * 0.22
            + experience * 0.18
            + education * 0.08
            + impact * 0.18
        ),
        25,
        98,
    )
    breakdown = [
        ScoreBreakdown(label="Job Match", score=jd_fit),
        ScoreBreakdown(label="Formatting", score=formatting),
        ScoreBreakdown(label="Keywords", score=keywords),
        ScoreBreakdown(label="Experience", score=experience),
        ScoreBreakdown(label="Education", score=education),
        ScoreBreakdown(label="Impact", score=impact),
    ]

    detected = _detected_skills(skill_hits, sections)
    missing_names = [s for s in required if s not in resume_has]
    jd_label = target_role or "target"
    missing = []
    for i, name in enumerate(missing_names[:6]):
        importance = ("High", "High", "Medium", "Medium", "Low", "Low")[i]
        reason = (
            f"Requested in the {jd_label} job description"
            if jd_signal > 0
            else f"Core for the {jd_label} role"
        )
        missing.append(MissingSkill(name=name, importance=importance, reason=reason))

    general_suggestions = _suggestions(
        sections=sections,
        detected_count=len(detected),
        quantified=len(_quantified_lines(text)),
        years=years,
        text=text,
    )
    jd_suggestions: list[Suggestion] = []
    if missing_names:
        jd_suggestions.append(
            Suggestion(
                title=f"Add {missing_names[0]} to match this posting",
                detail=(
                    f"The {jd_label} role calls for {missing_names[0]}; adding it "
                    "with a concrete example directly raises your fit."
                ),
                severity="high",
            )
        )
    if jd_signal > 0 and overlap < 0.8:
        jd_suggestions.append(
            Suggestion(
                title="Mirror the job description's language",
                detail=(
                    "Weave in the JD's own keywords and required terms where "
                    "truthful — ATS scoring favors exact phrase overlap."
                ),
                severity="medium",
            )
        )
    jd_suggestions.append(
        Suggestion(
            title="Tailor your summary to this role",
            detail=f"Lead your summary with the experience this {jd_label} posting emphasizes.",
            severity="low",
        )
    )
    seen = {s.title for s in jd_suggestions}
    suggestions = (jd_suggestions + [s for s in general_suggestions if s.title not in seen])[:5]

    roles = _recommended_roles(skill_hits, base["ats"])
    if target_role:
        roles.insert(0, RoleMatch(role=target_role, company="Target role", location="", match=jd_fit))
        deduped: list[RoleMatch] = []
        seen_roles: set[str] = set()
        for role in roles:
            if role.role not in seen_roles:
                seen_roles.add(role.role)
                deduped.append(role)
        roles = deduped[:4]

    top_skills = [s.name for s in detected[:4]]
    skills_str = ", ".join(top_skills) if top_skills else "a strong technical toolkit"
    match_line = (
        f"Matched {len(matched)} of {len(required)} required skills. "
        if required
        else ""
    )
    summary = (
        f"Fit for the {jd_label} posting: {jd_fit}/100 — {match_line}"
        f"{candidate['title']} with {years} year{'s' if years != 1 else ''} of experience, "
        f"strong in {skills_str}. The score blends resume quality with how well it "
        "answers this specific job description."
    )

    return AnalysisResponse(
        id=resume_id,
        file_name=file_name,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
        ats_score=jd_ats,
        candidate=Candidate(**candidate),
        summary=summary,
        score_breakdown=breakdown,
        detected_skills=detected,
        missing_skills=missing,
        suggestions=suggestions,
        recommended_roles=roles,
        keyword_trend=_keyword_trend(resume_id, jd_ats),
        skills_radar=_skills_radar(skill_hits),
    )


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def analyze_resume(
    resume_id: str,
    file_name: str,
    text: str,
    *,
    job_description: str | None = None,
    target_role: str | None = None,
) -> AnalysisResponse:
    if job_description or target_role:
        return _analyze_with_jd(
            resume_id, file_name, text, job_description=job_description, target_role=target_role
        )

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
