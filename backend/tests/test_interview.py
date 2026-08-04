"""Interview Prep — session start, offline scoring, and route tests.

conftest sets GEMINI_API_KEY="" and monkeypatches generate_text to raise, so
start_session always falls back to the template bank and score_answer to the
deterministic offline scorer.
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.interview_service import score_answer, start_session

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def analyzed_resume(client, auth):
    """Upload + analyze a real resume for a fresh owner; return {id, headers}."""
    user = auth()
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=user["headers"],
    ).json()
    resp = client.post(f"/api/resumes/{data['id']}/analyze", headers=user["headers"])
    assert resp.status_code == 200, resp.text
    return {"id": data["id"], "headers": user["headers"]}


def _run(coro):
    return asyncio.run(coro)


def test_start_session_endpoint_generic(client, auth):
    """No resume → a valid session from the generic template bank."""
    resp = client.post(
        "/api/interview/sessions",
        json={"role": "Frontend Engineer", "difficulty": "mid", "count": 4},
        headers=auth()["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["session_id"]
    assert body["role"] == "Frontend Engineer"
    assert body["difficulty"] == "mid"
    questions = body["questions"]
    assert len(questions) == 4
    for i, q in enumerate(questions):
        assert q["id"] == f"q{i + 1}"
        assert q["category"]
        assert q["text"]
        assert isinstance(q["evaluation_hints"], list) and q["evaluation_hints"]


def test_start_session_uses_resume_skills(client, analyzed_resume):
    """An analyzed resume feeds the question set; unknown ids still work."""
    resp = client.post(
        "/api/interview/sessions",
        json={"resume_id": analyzed_resume["id"], "count": 3},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["questions"]) == 3

    # A missing resume_id is not an error — interviews work without one.
    resp = client.post(
        "/api/interview/sessions",
        json={"resume_id": "does-not-exist", "count": 3},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200
    assert len(resp.json()["questions"]) == 3


def test_other_users_resume_does_not_leak(client, auth, analyzed_resume):
    """Another user's resume id behaves like 'no resume' — no skill leak, no 404."""
    other = auth()
    resp = client.post(
        "/api/interview/sessions",
        json={"resume_id": analyzed_resume["id"], "count": 3},
        headers=other["headers"],
    )
    assert resp.status_code == 200
    assert len(resp.json()["questions"]) == 3


def test_count_validated(client, auth):
    headers = auth()["headers"]
    assert client.post("/api/interview/sessions", json={"count": 2}, headers=headers).status_code == 422
    assert client.post("/api/interview/sessions", json={"count": 9}, headers=headers).status_code == 422
    assert client.post("/api/interview/sessions", json={"difficulty": "godlike"}, headers=headers).status_code == 422


def test_interview_endpoints_require_auth(client):
    assert client.post("/api/interview/sessions", json={"count": 3}).status_code == 401
    assert client.post(
        "/api/interview/feedback",
        json={"session_id": "x", "question_id": "q1", "answer": "a"},
    ).status_code == 401


def test_difficulty_scaling():
    """Junior/senior wording is applied on top of the same question text."""
    junior = _run(start_session(None, role="X", difficulty="junior", count=1))
    senior = _run(start_session(None, role="X", difficulty="senior", count=1))
    mid = _run(start_session(None, role="X", difficulty="mid", count=1))
    j_text, s_text, m_text = (
        junior.questions[0].text,
        senior.questions[0].text,
        mid.questions[0].text,
    )
    assert j_text.endswith("Keep the answer concrete and beginner-friendly.")
    assert s_text.endswith("Show trade-offs, failure modes, and how you'd scale it.")
    assert m_text == j_text.replace(
        " Keep the answer concrete and beginner-friendly.", ""
    )


def test_offline_score_ranks_strong_answer_above_weak():
    session = _run(start_session(None, role="Software Engineer", difficulty="mid", count=1))
    q = session.questions[0]

    strong = _run(
        score_answer(
            session.session_id,
            q.id,
            "I led the checkout redesign to a hard deadline. I scoped aggressively, "
            "cut a nice-to-have, and shipped on time. The result was a 12% lift in "
            "conversion. Key lessons: involve stakeholders early and measure after.",
        )
    )
    weak = _run(score_answer(session.session_id, q.id, "ok"))

    assert strong.score > weak.score
    assert 0 <= weak.score <= 100
    assert strong.strengths and strong.improvements and strong.model_answer


def test_offline_score_is_deterministic():
    session = _run(start_session(None, role="X", difficulty="mid", count=1))
    q = session.questions[0]
    a = _run(score_answer(session.session_id, q.id, "A repeatable answer with 20% detail."))
    b = _run(score_answer(session.session_id, q.id, "A repeatable answer with 20% detail."))
    assert a.score == b.score


def test_score_unknown_session_uses_fallback_question():
    feedback = _run(score_answer("no-such-session", "q7", "A solid, detailed answer."))
    assert feedback.question_id == "q7"
    assert 0 <= feedback.score <= 100
    assert feedback.model_answer


def test_feedback_endpoint_route(client, auth):
    headers = auth()["headers"]
    session = client.post(
        "/api/interview/sessions", json={"count": 3, "difficulty": "mid"}, headers=headers
    ).json()
    resp = client.post(
        "/api/interview/feedback",
        json={
            "session_id": session["session_id"],
            "question_id": "q1",
            "answer": "I shipped a feature that lifted signups by 8% and hit all the hints.",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["question_id"] == "q1"
    assert 0 <= body["score"] <= 100
    assert body["strengths"] and body["improvements"] and body["model_answer"]


def test_feedback_requires_answer(client, auth):
    resp = client.post(
        "/api/interview/feedback",
        json={"session_id": "x", "question_id": "q1", "answer": ""},
        headers=auth()["headers"],
    )
    assert resp.status_code == 422
