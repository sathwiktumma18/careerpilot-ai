"""Interview Prep — role-specific practice questions and answer feedback.

Question sets and answer scores come from Gemini when a key is present;
otherwise a curated template bank + keyword scoring keeps the feature fully
functional offline. Sessions are stateless on purpose: the session_id keys an
in-memory map to the generated questions so feedback can be scored against
each question's evaluation hints.
"""
from __future__ import annotations

import json
import logging
import re
from uuid import uuid4

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.resume import Resume
from app.schemas.interview import (
    Difficulty,
    InterviewFeedbackResponse,
    InterviewQuestion,
    InterviewStartResponse,
)
from app.services import ai_provider

logger = logging.getLogger(__name__)

MAX_SESSIONS = 50
_sessions: dict[str, list[InterviewQuestion]] = {}


def _remember(session_id: str, questions: list[InterviewQuestion]) -> None:
    """Keep recent sessions in memory (Phase 3 replaces this with storage)."""
    _sessions[session_id] = questions
    # Bounded so a long-running process can't grow without limit.
    while len(_sessions) > MAX_SESSIONS:
        _sessions.pop(next(iter(_sessions)))


# --------------------------------------------------------------------------- #
# Template question bank (fallback)
# --------------------------------------------------------------------------- #

_TEMPLATE_BANK: dict[str, list[dict]] = {
    "Frontend": [
        {
            "category": "Technical",
            "text": "How would you optimize the initial load of a React SPA that renders a large data grid?",
            "hints": ("code-split", "lazy", "memoization", "virtualiz", "bundle"),
        },
        {
            "category": "Technical",
            "text": "Explain how React reconciliation works and when you'd reach for a key prop. What breaks without it?",
            "hints": ("virtual dom", "reconcile", "diff", "key", "re-render"),
        },
        {
            "category": "System Design",
            "text": "Design a real-time collaborative document UI. How do you keep 50 cursors smooth while editing?",
            "hints": ("optimistic", "debounce", "websocket", "throttle", "coarse"),
        },
        {
            "category": "Behavioral",
            "text": "Tell me about a time you shipped a frontend feature that changed a metric you cared about.",
            "hints": ("metric", "impact", "measured", "result", "lead"),
        },
        {
            "category": "Technical",
            "text": "What are the trade-offs between client-side and server-side rendering for a marketing site vs an app?",
            "hints": ("seo", "ttfb", "hydration", "caching", "interactive"),
        },
    ],
    "Backend": [
        {
            "category": "Technical",
            "text": "Design an idempotent payments API. How do you guarantee exactly-once processing at scale?",
            "hints": ("idempoten", "retry", "dedupe", "transaction", "race"),
        },
        {
            "category": "System Design",
            "text": "You're building a rate limiter for a public API. Walk through the design and failure modes.",
            "hints": ("token bucket", "leaky", "redis", "distributed", "429"),
        },
        {
            "category": "Technical",
            "text": "How would you debug a query that slows from 50ms to 5s after a deploy? Where do you look first?",
            "hints": ("index", "explain", "plan", "n+1", "lock"),
        },
        {
            "category": "Behavioral",
            "text": "Describe an incident you helped resolve. What was your role and what did you change afterward?",
            "hints": ("incident", "on-call", "postmortem", "blameless", "follow-up"),
        },
        {
            "category": "Technical",
            "text": "When would you choose a message queue over a REST endpoint? Show the failure handling.",
            "hints": ("async", "retry", "dead letter", "consumer", "backpressure"),
        },
    ],
    "DevOps": [
        {
            "category": "Technical",
            "text": "Walk through how you'd deploy a zero-downtime update to a Kubernetes service.",
            "hints": ("rolling", "readiness", "probe", "canary", "rollback"),
        },
        {
            "category": "System Design",
            "text": "Design a CI/CD pipeline that ships safely to production 10 times a day.",
            "hints": ("staged", "feature flag", "automated test", "rollback", "observability"),
        },
        {
            "category": "Technical",
            "text": "Your service is at 99.9% uptime and drops to 95% after a change. How do you isolate the cause?",
            "hints": ("metrics", "trace", "log", "rollback", "bisect"),
        },
        {
            "category": "Behavioral",
            "text": "Tell me about a time you automated away a toil-heavy task. What was the impact?",
            "hints": ("toil", "automated", "hours", "script", "time saved"),
        },
        {
            "category": "Technical",
            "text": "What's in your infrastructure-as-code review checklist before merging a Terraform change?",
            "hints": ("plan", "state", "impact", "permission", "drift"),
        },
    ],
    "Data": [
        {
            "category": "Technical",
            "text": "Design a feature that detects anomalies in a real-time metrics stream. How do you keep latency low?",
            "hints": ("window", "statistical", "threshold", "rolling", "drift"),
        },
        {
            "category": "System Design",
            "text": "You need a dashboard of daily KPIs. Walk through the pipeline from source events to chart.",
            "hints": ("etl", "aggregation", "warehouse", "incremental", "schema"),
        },
        {
            "category": "Technical",
            "text": "How do you validate an ML model before it ships, and how do you detect drift afterward?",
            "hints": ("holdout", "metrics", "precision", "recall", "monitor"),
        },
        {
            "category": "Behavioral",
            "text": "Describe a decision you made from data that others disagreed with at first.",
            "hints": ("experiment", "ab", "data", "stakeholder", "outcome"),
        },
        {
            "category": "Technical",
            "text": "A/B test: 10% of users get a new checkout. How do you know it's a real win?",
            "hints": ("significance", "sample", "p-value", "baseline", "segmentation"),
        },
    ],
    "Product": [
        {
            "category": "Behavioral",
            "text": "Tell me about a product decision you owned that involved a real trade-off. How did you decide?",
            "hints": ("trade-off", "stakeholder", "metric", "decision", "user"),
        },
        {
            "category": "Technical",
            "text": "How do you scope a feature when engineering says three weeks and the launch date is fixed?",
            "hints": ("mvp", "prioritize", "cut scope", "communicate", "milestone"),
        },
        {
            "category": "System Design",
            "text": "Design the onboarding flow for a new SaaS user. What signals tell you it's working?",
            "hints": ("activation", "funnel", "time to value", "drop-off", "cohort"),
        },
        {
            "category": "Behavioral",
            "text": "Give an example of pushing back on a stakeholder and keeping the relationship intact.",
            "hints": ("data", "listen", "alternative", "alignment", "respectful"),
        },
        {
            "category": "Technical",
            "text": "A critical bug ships to prod. Describe how you run the triage and the communication plan.",
            "hints": ("priority", "owner", "status page", "escalate", "postmortem"),
        },
    ],
    "Design": [
        {
            "category": "Behavioral",
            "text": "Walk me through a design you shipped end to end, from problem framing to handoff.",
            "hints": ("research", "persona", "iterated", "usability", "handoff"),
        },
        {
            "category": "Technical",
            "text": "How do you balance visual polish with implementation cost when a deadline looms?",
            "hints": ("constraint", "pattern", "compromise", "component", "priority"),
        },
        {
            "category": "System Design",
            "text": "Design a design-system governance process that a team of 20 engineers actually follows.",
            "hints": ("tokens", "contribution", "review", "versioning", "adoption"),
        },
        {
            "category": "Behavioral",
            "text": "Tell me about a time user testing contradicted your initial direction.",
            "hints": ("test", "changed", "feedback", "evidence", "revised"),
        },
        {
            "category": "Technical",
            "text": "How do you make an interface accessible when the existing app scores poorly on audit?",
            "hints": ("a11y", "wcag", "contrast", "keyboard", "screen reader"),
        },
    ],
}

_GENERIC_BANK: list[dict] = [
    {
        "category": "Behavioral",
        "text": "Tell me about a time you led a feature through to launch against a tight deadline.",
        "hints": ("scope", "deadline", "led", "result", "lessons"),
    },
    {
        "category": "Technical",
        "text": "Describe a hard technical problem you solved that wasn't well documented anywhere.",
        "hints": ("research", "root cause", "experiment", "solution", "verified"),
    },
    {
        "category": "Behavioral",
        "text": "Tell me about a time you disagreed with a senior engineer. How was it resolved?",
        "hints": ("data", "listened", "compromise", "respect", "outcome"),
    },
    {
        "category": "Behavioral",
        "text": "How do you stay current in your field, and how has that paid off recently?",
        "hints": ("learning", "community", "practice", "shipped", "recent"),
    },
    {
        "category": "Technical",
        "text": "Walk me through how you debug a production issue you've never seen before.",
        "hints": ("reproduce", "logs", "metrics", "isolate", "hypothesis"),
    },
]


def _role_category(skills: list[str]) -> str:
    """Pick the closest template category from the resume's skill mix."""
    from app.services.skill_catalog import SKILLS

    counts: dict[str, int] = {}
    for skill in SKILLS:
        if skill.name in skills:
            counts[skill.category] = counts.get(skill.category, 0) + 1
    return max(counts, key=counts.get) if counts else ""


def _template_questions(category_hint: str, count: int, difficulty: Difficulty) -> list[InterviewQuestion]:
    bank = _TEMPLATE_BANK.get(category_hint) or _GENERIC_BANK
    picked = (bank * 2)[:count]  # wrap if count > len(bank)
    return [
        InterviewQuestion(
            id=f"q{i + 1}",
            category=q["category"],
            text=_scale_question(q["text"], difficulty),
            evaluation_hints=list(q["hints"]),
        )
        for i, q in enumerate(picked)
    ]


def _scale_question(text: str, difficulty: Difficulty) -> str:
    if difficulty == "junior":
        return text + " Keep the answer concrete and beginner-friendly."
    if difficulty == "senior":
        return text + " Show trade-offs, failure modes, and how you'd scale it."
    return text


# --------------------------------------------------------------------------- #
# Gemini generation
# --------------------------------------------------------------------------- #

def _questions_prompt(role: str, difficulty: Difficulty, skills: list[str], count: int) -> str:
    skill_list = ", ".join(skills) if skills else "(no resume — generic questions)"
    return f"""You are a senior engineering interviewer preparing a candidate for a {role} role at {difficulty} level.

Their resume shows these skills: {skill_list}.

Generate {count} interview questions. Mix behavioral and technical/system-design. Make them specific to the skills and the level — a senior question must probe trade-offs and scale, a junior question stays concrete.

Return ONLY valid JSON matching this EXACT schema:
{{"questions": [{{"category": "Behavioral|Technical|System Design", "text": "the question", "evaluation_hints": ["2-4 short phrases a strong answer should cover"]}}]}}
No commentary, no markdown, no fields outside the schema."""


def _feedback_prompt(question_text: str, answer: str) -> str:
    return f"""You are a senior interview coach. Score this candidate's answer to the question below.
Question: {question_text}
Answer: {answer}

Return ONLY valid JSON matching this EXACT schema:
{{"score": 0, "strengths": ["2-3 short strings"], "improvements": ["2-3 actionable strings"], "model_answer": "one short model answer"}}
- score is an integer 0-100.
- Be specific, fair, and encouraging. No markdown, no extra fields."""


def _parse_questions(raw: str, count: int) -> list[InterviewQuestion]:
    data = ai_provider._extract_json(raw)
    out: list[InterviewQuestion] = []
    for i, q in enumerate(data.get("questions", [])[:count]):
        out.append(
            InterviewQuestion(
                id=f"q{i + 1}",
                category=str(q.get("category", "Technical")),
                text=str(q.get("text", "")).strip(),
                evaluation_hints=[str(h) for h in q.get("evaluation_hints", [])][:4],
            )
        )
    if not out:
        raise ValueError("No questions returned")
    return out


def _parse_feedback(raw: str) -> InterviewFeedbackResponse:
    data = ai_provider._extract_json(raw)
    return InterviewFeedbackResponse(
        question_id="",
        score=max(0, min(100, int(data.get("score", 0)))),
        strengths=[str(s) for s in data.get("strengths", [])][:3],
        improvements=[str(s) for s in data.get("improvements", [])][:3],
        model_answer=str(data.get("model_answer", "")),
    )


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

async def start_session(
    db: Session,
    *,
    role: str,
    difficulty: Difficulty,
    count: int,
    resume_id: str | None = None,
) -> InterviewStartResponse:
    skills: list[str] = []
    if resume_id:
        resume = db.get(Resume, resume_id)
        if resume and resume.analysis:
            skills = [s["name"] for s in resume.analysis.get("detected_skills", [])]

    questions: list[InterviewQuestion] | None = None
    if skills and settings.gemini_api_key:
        try:
            raw = await ai_provider.generate_text(
                _questions_prompt(role, difficulty, skills, count),
                json_mode=True,
                temperature=0.4,
            )
            questions = _parse_questions(raw, count)
        except (ai_provider.ProviderError, ValueError, json.JSONDecodeError):
            logger.warning("Gemini question generation failed; using template bank", exc_info=True)

    if questions is None:
        questions = _template_questions(_role_category(skills), count, difficulty)

    session_id = str(uuid4())
    _remember(session_id, questions)
    return InterviewStartResponse(
        session_id=session_id, role=role, difficulty=difficulty, questions=questions
    )


async def score_answer(session_id: str, question_id: str, answer: str) -> InterviewFeedbackResponse:
    questions = _sessions.get(session_id)
    question = next((q for q in questions if q.id == question_id), None) if questions else None
    if question is None:
        question = InterviewQuestion(
            id=question_id,
            category="Technical",
            text="Answer this question as best you can.",
            evaluation_hints=["specific example", "result", "trade-off", "reflection"],
        )

    if settings.gemini_api_key:
        try:
            raw = await ai_provider.generate_text(
                _feedback_prompt(question.text, answer), json_mode=True, temperature=0.3
            )
            return _parse_feedback(raw)
        except (ai_provider.ProviderError, ValueError, json.JSONDecodeError):
            logger.warning("Gemini feedback failed; using offline scoring", exc_info=True)

    return _offline_score(question, answer)


def _offline_score(question: InterviewQuestion, answer: str) -> InterviewFeedbackResponse:
    """Deterministic fallback: hint coverage + length + specificity."""
    norm = answer.lower()
    hits = sum(1 for hint in question.evaluation_hints if hint in norm)
    coverage = min(1.0, hits / max(len(question.evaluation_hints), 1))
    words = len(answer.split())
    length_score = min(1.0, words / 140)
    specificity = 0.2 if re.search(r"\d|%|grew|reduced|increased|cut|users|time", norm) else 0.0
    score = round(100 * min(1.0, 0.55 * coverage + 0.3 * length_score + specificity))

    if coverage >= 0.6 and words >= 60:
        strengths = ["Covers most of what a strong answer hits.", "Reasonable depth for this question."]
    elif words >= 30:
        strengths = ["You gave a structured answer worth building on."]
    else:
        strengths = ["You started — expand on the key points below."]

    improvements = [f"Address the hints a strong answer covers: {', '.join(question.evaluation_hints)}."]
    if words < 60:
        improvements.append("Aim for 100+ words with a concrete example and a result.")
    if not specificity:
        improvements.append("Add a measurable outcome — numbers beat adjectives in interviews.")

    covered = ", ".join(question.evaluation_hints[: max(hits, 1)])
    model_answer = (
        f"A strong answer would hit: {covered}. Use a specific example (STAR: situation, "
        "task, action, result), name the trade-offs, and close with what you learned or "
        "would do differently."
    )
    return InterviewFeedbackResponse(
        question_id=question.id,
        score=max(0, min(100, score)),
        strengths=strengths,
        improvements=improvements,
        model_answer=model_answer,
    )
