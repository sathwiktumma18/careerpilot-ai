"""Job Match — rank a resume against the curated job corpus.

Scoring is a hybrid of two signals:
  1. Skill overlap (65%)  — what share of a job's required skills appear in
     the resume's detected skills (from its analysis).
  2. Semantic similarity (35%) — cosine similarity in embedding space between
     the resume text and each job description. Uses Gemini embeddings when a
     key is present (corpus vectors cached on disk to respect free-tier
     quotas); otherwise a dependency-free TF-IDF cosine fallback.

Either matcher alone is enough — the LLM layer is optional, not required.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.services import ai_provider
from app.services.job_corpus import JOBS, Job
from app.services.pdf_parser import PdfParseError, extract_text
from app.services.resume_service import ResumeNotFoundError, resume_service
from app.services.skill_catalog import SKILLS, alias_pattern, normalize_name

logger = logging.getLogger(__name__)

EMBEDDING_CACHE_FILE = Path(settings.upload_dir).parent / "job_embeddings.json"

# Blend weights (skill overlap dominates; embedding refines).
SKILL_WEIGHT = 0.65
SIM_WEIGHT = 0.35

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "with",
    "without", "on", "in", "at", "by", "of", "to", "from", "as", "is", "are",
    "was", "were", "be", "been", "being", "this", "that", "these", "those",
    "it", "its", "your", "our", "we", "you", "job", "role", "team", "etc",
    "e.g", "also", "plus", "like", "help", "work",
}
_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-]*")


class JobMatchError(Exception):
    pass


# --------------------------------------------------------------------------- #
# Skill extraction (resume side)
# --------------------------------------------------------------------------- #

def _parse_resume_skills(analysis: dict) -> list[str]:
    """Pull canonical detected-skill names out of a stored analysis."""
    return [s["name"] for s in analysis.get("detected_skills", [])]


def _skills_in_text(text: str) -> list[str]:
    """Alias-based detection of catalog skills in arbitrary text (a pasted JD)."""
    norm = text.lower()
    found: list[str] = []
    for skill in SKILLS:
        pattern = re.compile("|".join(alias_pattern(a) for a in skill.aliases))
        if pattern.search(norm):
            found.append(skill.name)
    return found


# --------------------------------------------------------------------------- #
# Semantic similarity
# --------------------------------------------------------------------------- #

def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _tfidf_cosine_scores(resume_text: str, job_texts: list[str]) -> list[float]:
    """Dependency-free TF-IDF cosine similarity between resume and each job."""
    docs = [resume_text, *job_texts]

    def tokens(text: str) -> list[str]:
        return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 1]

    counts = [dict(_count_tokens(tokens(d))) for d in docs]
    vocab: set[str] = set()
    for c in counts:
        vocab.update(c)

    n = len(docs)
    idf = {w: math.log((n + 1) / (sum(1 for c in counts if w in c) + 1)) + 1 for w in vocab}
    vecs = [{w: c.get(w, 0) * idf[w] for w in c} for c in counts]

    def cos(a: dict, b: dict) -> float:
        dot = sum(a.get(w, 0) * b.get(w, 0) for w in set(a) | set(b))
        na = math.sqrt(sum(v * v for v in a.values()))
        nb = math.sqrt(sum(v * v for v in b.values()))
        return dot / (na * nb) if na and nb else 0.0

    resume_vec = vecs[0]
    return [cos(resume_vec, v) for v in vecs[1:]]


def _count_tokens(tokens: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for t in tokens:
        out[t] = out.get(t, 0) + 1
    return out


def _stable_key(texts: list[str]) -> str:
    return hashlib.sha256("|".join(texts).encode("utf-8")).hexdigest()


def _load_cached_embeddings(key: str) -> dict[str, list[float]] | None:
    try:
        data = json.loads(EMBEDDING_CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if data.get("key") != key:
        return None
    return data.get("vectors", {})


def _save_cached_embeddings(key: str, vectors: dict[str, list[float]]) -> None:
    try:
        EMBEDDING_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        EMBEDDING_CACHE_FILE.write_text(
            json.dumps({"key": key, "vectors": vectors}), encoding="utf-8"
        )
    except OSError:
        logger.warning("Could not write embedding cache to %s", EMBEDDING_CACHE_FILE)


async def _semantic_scores(
    resume_text: str, corpus_texts: list[str], extra_texts: list[str]
) -> tuple[list[float], str]:
    """Return (scores for [*corpus_texts, *extra_texts], method).

    Corpus vectors are cached on disk (static between requests); extra texts
    (the resume + any pasted JD) are embedded per request.
    """
    if not settings.gemini_api_key:
        return _tfidf_cosine_scores(resume_text, corpus_texts + extra_texts), "tfidf"

    try:
        corpus_key = _stable_key(corpus_texts)
        cached = _load_cached_embeddings(corpus_key)
        if cached is None:
            vectors = await ai_provider.embed_texts(corpus_texts)
            cached = {str(i): v for i, v in enumerate(vectors)}
            _save_cached_embeddings(corpus_key, cached)

        resume_emb, *extra_embs = await ai_provider.embed_texts([resume_text, *extra_texts])
        sims = [_cosine(resume_emb, cached[str(i)]) for i in range(len(corpus_texts))]
        sims += [_cosine(resume_emb, e) for e in extra_embs]
        return sims, "gemini"
    except (ai_provider.ProviderError, Exception) as exc:  # noqa: BLE001
        logger.warning("Gemini embeddings failed (%s); falling back to TF-IDF", exc)
        return _tfidf_cosine_scores(resume_text, corpus_texts + extra_texts), "tfidf"


# --------------------------------------------------------------------------- #
# Match assembly
# --------------------------------------------------------------------------- #

def _score_job(
    job: Job,
    resume_skills: set[str],
    semantic_sim: float,
) -> tuple[int, list[str], list[str], list[str]]:
    matched = [s for s in job.required_skills if s in resume_skills]
    missing = [s for s in job.required_skills if s not in resume_skills]
    bonus = [s for s in job.preferred_skills if s in resume_skills]
    overlap = len(matched) / len(job.required_skills) if job.required_skills else 0.0
    score = round(100 * (SKILL_WEIGHT * overlap + SIM_WEIGHT * semantic_sim))
    return max(0, min(100, score)), matched, missing, bonus


def _job_summary(job: Job, matched: list[str], missing: list[str]) -> str:
    if missing:
        gap = ", ".join(missing[:3])
        return (
            f"Strong fit on {', '.join(matched[:3]) or 'your core stack'}; "
            f"close the gap on {gap} to stand out."
        )
    return f"Every required skill matched — {', '.join(matched[:4])}."


def _build_result(
    job: Job, resume_skills: set[str], semantic_sim: float, source: str
) -> dict:
    score, matched, missing, bonus = _score_job(job, resume_skills, semantic_sim)
    # A salary of 0 means "not advertised" (e.g. pasted JD) → surface as None.
    has_salary = job.salary_min > 0 or job.salary_max > 0
    return {
        "job_id": job.job_id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "remote": job.remote,
        "salary_min": job.salary_min if has_salary else None,
        "salary_max": job.salary_max if has_salary else None,
        "match_score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "bonus_skills": bonus,
        "summary": _job_summary(job, matched, missing),
        "source": source,
    }


async def match_resume(
    db: Session,
    resume_id: str,
    *,
    user_id: str,
    job_description: str = "",
    remote_only: bool = False,
    locations: list[str] | None = None,
    limit: int = 10,
) -> dict:
    # Only the resume's owner may match against it — someone else's id 404s.
    resume = resume_service.get_owned(db, resume_id, user_id)
    cv = resume.current_version
    if cv is None or not cv.analysis:
        raise JobMatchError("Analyze this resume first — matching needs its skill profile.")

    raw_detected = _parse_resume_skills(cv.analysis)
    if not raw_detected:
        raise JobMatchError("No skills detected on this resume yet. Try re-analyzing.")
    # Match on canonical catalog names so an LLM's "PostgreSQL" aligns with the
    # corpus's "SQL"; show the user the resume's own (raw) skill names.
    resume_skills = {normalize_name(s) for s in raw_detected}

    try:
        resume_text = cv.text or extract_text(cv.file_path)
    except PdfParseError as exc:
        raise JobMatchError(f"Could not read resume text: {exc}") from exc

    # Filter the corpus before scoring so filters apply to every candidate.
    locations_norm = [loc.lower() for loc in (locations or [])]
    corpus = [
        j
        for j in JOBS
        if (not remote_only or j.remote)
        and (not locations_norm or any(loc in j.location.lower() for loc in locations_norm))
    ]

    # A pasted JD becomes a pseudo-job so it flows through the same scorer.
    pseudo: Job | None = None
    if job_description.strip():
        jd_skills = _skills_in_text(job_description)
        pseudo = Job(
            job_id="paste",
            title="Your pasted job description",
            company="",
            location="",
            remote=False,
            salary_min=0,
            salary_max=0,
            category="",
            description=job_description,
            # Never an empty required set: even an unparseable JD must score.
            required_skills=tuple(jd_skills) or ("Python",),
        )

    extra_texts = [job_description] if pseudo else []
    sim_scores, method = await _semantic_scores(resume_text, [j.description for j in corpus], extra_texts)

    results = []
    if pseudo:
        results.append(_build_result(pseudo, resume_skills, sim_scores[-1], "paste"))
        results += [
            _build_result(job, resume_skills, sim, "corpus")
            for job, sim in zip(corpus, sim_scores[:-1])
        ]
    else:
        results = [
            _build_result(job, resume_skills, sim, "corpus")
            for job, sim in zip(corpus, sim_scores)
        ]

    results.sort(key=lambda r: (-r["match_score"], r["title"]))
    results = results[:limit]

    return {
        "resume_id": resume_id,
        "resume_title": (cv.analysis.get("candidate") or {}).get("title", "Resume"),
        "detected_skills": sorted(set(raw_detected)),
        "method": method,
        "results": results,
    }


def list_jobs() -> list[dict]:
    return [
        {
            "job_id": j.job_id,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "remote": j.remote,
            "salary_min": j.salary_min,
            "salary_max": j.salary_max,
            "category": j.category,
            "skills_count": len(j.required_skills),
            "description": j.description,
        }
        for j in JOBS
    ]
