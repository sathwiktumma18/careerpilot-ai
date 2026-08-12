"""AI provider chain — Gemini (free tier) → Ollama (local) → no-key fallback.

Every consumer calls the top-level helpers and never cares which provider
answered. If the LLM is unavailable or returns unparseable JSON, we degrade
gracefully to `fallback_analyzer`, which reads the real resume text — so the
pipeline is always functional, and upgrades to real LLM output automatically
when a key or local model is present.
"""
from __future__ import annotations

import json
import logging
import re

import httpx

from app.config.settings import settings
from app.schemas.resume import AnalysisResponse
from app.services import fallback_analyzer

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class ProviderError(Exception):
    """All providers failed to answer."""


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response (handles fences/prose)."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ProviderError("No JSON object in model response")
    return json.loads(cleaned[start : end + 1])


async def _call_gemini(prompt: str, *, json_mode: bool = True, temperature: float = 0.2) -> str:
    if not settings.gemini_api_key:
        raise ProviderError("Gemini key not configured")
    url = f"{GEMINI_BASE}/models/{settings.gemini_model}:generateContent"
    payload: dict = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    if json_mode:
        payload["generationConfig"]["response_mime_type"] = "application/json"

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            url, json=payload, params={"key": settings.gemini_api_key}
        )
        if resp.status_code >= 400:
            raise ProviderError(f"Gemini error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderError(f"Unexpected Gemini response: {str(data)[:200]}") from exc


async def _call_ollama(prompt: str, *, json_mode: bool = True) -> str:
    url = f"{settings.ollama_url}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt + ("\nRespond with ONLY valid JSON." if json_mode else ""),
        "stream": False,
        "options": {"temperature": 0.2},
    }
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise ProviderError(f"Ollama unreachable: {exc}") from exc
    if resp.status_code >= 400:
        raise ProviderError(f"Ollama error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    return str(data.get("response", ""))


async def generate_text(prompt: str, *, json_mode: bool = True, temperature: float = 0.2) -> str:
    """Try Gemini then Ollama. Raises ProviderError if neither answers."""
    last_error: Exception | None = None
    if settings.gemini_api_key:
        try:
            return await _call_gemini(prompt, json_mode=json_mode, temperature=temperature)
        except ProviderError as exc:
            last_error = exc
            logger.warning("Gemini failed (%s); trying Ollama", exc)
    try:
        return await _call_ollama(prompt, json_mode=json_mode)
    except ProviderError as exc:
        last_error = exc
    raise ProviderError("All AI providers unavailable") from last_error


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Gemini embeddings. Raises ProviderError when no key / model unreachable."""
    if not settings.gemini_api_key:
        raise ProviderError("Gemini key not configured for embeddings")
    url = f"{GEMINI_BASE}/models/{settings.gemini_embedding_model}:batchEmbedContents"
    payload = {
        "requests": [{"model": f"models/{settings.gemini_embedding_model}", "content": {"parts": [{"text": t}]}} for t in texts]
    }
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=payload, params={"key": settings.gemini_api_key})
        if resp.status_code >= 400:
            raise ProviderError(f"Embedding error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
    try:
        return [item["values"] for item in data["embeddings"]]
    except (KeyError, TypeError) as exc:
        raise ProviderError(f"Unexpected embedding response: {str(data)[:200]}") from exc


# --------------------------------------------------------------------------- #
# Analysis chain
# --------------------------------------------------------------------------- #

_ANALYSIS_SCHEMA_EXAMPLE = {
    "id": "string",
    "file_name": "resume.pdf",
    "uploaded_at": "ISO-8601 string",
    "ats_score": 0,
    "candidate": {"name": "", "title": "", "location": "", "email": "", "years_experience": 0},
    "summary": "string",
    "score_breakdown": [{"label": "Formatting", "score": 0}],
    "detected_skills": [{"name": "React", "level": 0}],
    "missing_skills": [{"name": "Kubernetes", "importance": "High", "reason": "string"}],
    "suggestions": [{"title": "", "detail": "", "severity": "high"}],
    "recommended_roles": [{"role": "", "company": "", "location": "", "match": 0}],
    "keyword_trend": [{"month": "Jan", "score": 0}],
    "skills_radar": [{"area": "Frontend", "value": 0}],
}


def _analysis_prompt(
    file_name: str,
    text: str,
    *,
    job_description: str | None = None,
    target_role: str | None = None,
) -> str:
    jd_section = ""
    jd_note = ""
    if job_description or target_role:
        jd_note = (
            "This is a JD-SPECIFIC analysis: ats_score must measure the resume's "
            "fit for the posted job, missing_skills must be skills the JOB asks "
            "for that the resume lacks, and suggestions must target closing the "
            "gap with this posting. Score against the JD, not a generic role.\n"
        )
        jd_section = f"""JOB DESCRIPTION (score the resume against THIS):
{job_description[:10000] if job_description else "(no pasted JD — use the target role's typical requirements)"}

TARGET ROLE: {target_role or "N/A"}
"""

    return f"""You are a meticulous senior resume reviewer and ATS specialist.

Analyze the resume below and return ONLY valid JSON matching this EXACT schema.
Do not add commentary, markdown, or fields outside the schema.

SCHEMA (all keys required):
{json.dumps(_ANALYSIS_SCHEMA_EXAMPLE, indent=2)}

CONSTRAINTS:
- ats_score and all scores/levels/matches are integers 0-100.
- detected_skills: skills actually evidenced in the text (max 14), level = strength.
- missing_skills: skills NOT in the resume that the role needs; importance is High|Medium|Low.
- suggestions: 3-5 specific, actionable items; severity is high|medium|low.
- recommended_roles: 4 roles with a match score grounded in the resume's skill mix.
- keyword_trend: exactly 6 points, months Jan..Jun, a plausible score progression.
- skills_radar: exactly one entry per area in ["Frontend","Backend","DevOps","Data","Product","Design"].
- candidate: derive name/email from the text if present, else "".
- Do not invent experience, skills, or companies.

{jd_note}{jd_section}
Resume file name: {file_name}

RESUME TEXT:
{text[:12000]}
"""


async def analyze_resume(
    resume_id: str,
    file_name: str,
    text: str,
    *,
    job_description: str | None = None,
    target_role: str | None = None,
) -> AnalysisResponse:
    """Run the provider chain and return a schema-validated analysis.

    Pass `job_description` / `target_role` to score the resume against a
    specific posting instead of a generic benchmark. Never raises for provider
    issues: worst case it falls back to the deterministic analyzer so the user
    always gets a result.
    """
    prompt = _analysis_prompt(
        file_name, text, job_description=job_description, target_role=target_role
    )
    try:
        raw = await generate_text(prompt, json_mode=True, temperature=0.2)
        data = _extract_json(raw)
        # id/file_name are server-owned: never trust the model's copy (it may
        # invent an id like "res_..." instead of the real resume id).
        data["id"] = resume_id
        data["file_name"] = file_name
        return AnalysisResponse.model_validate(data)
    except (ProviderError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("LLM analysis failed (%s); using fallback analyzer", exc)
        return fallback_analyzer.analyze_resume(
            resume_id, file_name, text, job_description=job_description, target_role=target_role
        )
    try:
        raw = await generate_text(prompt, json_mode=True, temperature=0.2)
        data = _extract_json(raw)
        # id/file_name are server-owned: never trust the model's copy (it may
        # invent an id like "res_..." instead of the real resume id).
        data["id"] = resume_id
        data["file_name"] = file_name
        return AnalysisResponse.model_validate(data)
    except (ProviderError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("LLM analysis failed (%s); using fallback analyzer", exc)
        return fallback_analyzer.analyze_resume(resume_id, file_name, text)
