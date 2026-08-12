"""Messaging: thread lifecycle, participant-only access, unread flags."""
import uuid

from fastapi.testclient import TestClient

from app.main import create_app


def _register(role: str = "job_seeker") -> dict:
    """Register a fresh user and return {user_id, headers}."""
    with TestClient(create_app()) as c:
        resp = c.post(
            "/api/auth/register",
            json={
                "name": f"{role.title().replace('_', ' ')}",
                "email": f"msg-{uuid.uuid4().hex[:10]}@example.com",
                "password": "hunter2-secure",
                "role": role,
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        return {
            "user_id": body["user"]["id"],
            "headers": {"Authorization": f"Bearer {body['access_token']}"},
        }


def test_seeker_starts_thread_with_recruiter():
    seeker = _register("job_seeker")
    recruiter = _register("recruiter")

    with TestClient(create_app()) as c:
        resp = c.post(
            "/api/messages",
            json={"user_id": recruiter["user_id"]},
            headers=seeker["headers"],
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["seeker_id"] == seeker["user_id"]
        assert body["recruiter_id"] == recruiter["user_id"]
        convo_id = body["id"]

        # Get-or-create: a second call returns the SAME thread.
        resp2 = c.post(
            "/api/messages",
            json={"user_id": recruiter["user_id"]},
            headers=seeker["headers"],
        )
        assert resp2.json()["id"] == convo_id


def test_send_and_read_messages():
    seeker = _register("job_seeker")
    recruiter = _register("recruiter")

    with TestClient(create_app()) as c:
        convo_id = c.post(
            "/api/messages", json={"user_id": recruiter["user_id"]}, headers=seeker["headers"]
        ).json()["id"]

        sent = c.post(
            f"/api/messages/{convo_id}",
            json={"body": "Hi, I saw your profile!"},
            headers=seeker["headers"],
        )
        assert sent.status_code == 201, sent.text

        reply = c.post(
            f"/api/messages/{convo_id}",
            json={"body": "Thanks for reaching out!"},
            headers=recruiter["headers"],
        )
        assert reply.status_code == 201, reply.text

        thread = c.get(f"/api/messages/{convo_id}", headers=seeker["headers"]).json()
        assert [m["body"] for m in thread["messages"]] == [
            "Hi, I saw your profile!",
            "Thanks for reaching out!",
        ]


def test_unread_counts_clear_on_read():
    seeker = _register("job_seeker")
    recruiter = _register("recruiter")

    with TestClient(create_app()) as c:
        convo_id = c.post(
            "/api/messages", json={"user_id": recruiter["user_id"]}, headers=seeker["headers"]
        ).json()["id"]
        c.post(f"/api/messages/{convo_id}", json={"body": "Hello?"}, headers=seeker["headers"])

        # Recruiter's inbox sees 1 unread + a preview.
        inbox = c.get("/api/messages", headers=recruiter["headers"]).json()
        assert len(inbox) == 1
        assert inbox[0]["unread_count"] == 1
        assert inbox[0]["preview"] == "Hello?"
        assert inbox[0]["other_user_id"] == seeker["user_id"]

        # Reading the thread clears it.
        c.get(f"/api/messages/{convo_id}", headers=recruiter["headers"])
        inbox = c.get("/api/messages", headers=recruiter["headers"]).json()
        assert inbox[0]["unread_count"] == 0


def test_only_participants_can_read():
    seeker = _register("job_seeker")
    recruiter = _register("recruiter")
    outsider = _register("job_seeker")

    with TestClient(create_app()) as c:
        convo_id = c.post(
            "/api/messages", json={"user_id": recruiter["user_id"]}, headers=seeker["headers"]
        ).json()["id"]

        assert c.get(f"/api/messages/{convo_id}", headers=outsider["headers"]).status_code == 404
        assert (
            c.post(
                f"/api/messages/{convo_id}", json={"body": "nope"}, headers=outsider["headers"]
            ).status_code
            == 404
        )
        assert c.get(f"/api/messages/{convo_id}", headers=seeker["headers"]).status_code == 200


def test_same_role_rejected():
    seeker1 = _register("job_seeker")
    seeker2 = _register("job_seeker")

    with TestClient(create_app()) as c:
        resp = c.post(
            "/api/messages", json={"user_id": seeker2["user_id"]}, headers=seeker1["headers"]
        )
        assert resp.status_code == 400


def test_recruiter_candidate_detail_includes_thread():
    # The candidate needs a resume_analyzed activity to appear in the pool.
    from tests.fixtures import resume_pdf_bytes

    seeker = _register("job_seeker")
    recruiter = _register("recruiter")

    with TestClient(create_app()) as c:
        up = c.post(
            "/api/resumes",
            files={"file": ("resume.pdf", resume_pdf_bytes(), "application/pdf")},
            headers=seeker["headers"],
        )
        assert up.status_code == 201, up.text
        resume_id = up.json()["id"]
        an = c.post(f"/api/resumes/{resume_id}/analyze", headers=seeker["headers"])
        assert an.status_code == 200, an.text

        # Before any thread: candidate detail has conversation_id = null.
        detail = c.get(
            f"/api/recruiter/candidates/{seeker['user_id']}", headers=recruiter["headers"]
        )
        assert detail.status_code == 200, detail.text
        assert detail.json()["conversation_id"] is None

        # Start a thread, then the detail carries it.
        c.post(
            "/api/messages", json={"user_id": recruiter["user_id"]}, headers=seeker["headers"]
        )
        detail = c.get(
            f"/api/recruiter/candidates/{seeker['user_id']}", headers=recruiter["headers"]
        ).json()
        assert detail["conversation_id"]


def test_recruiter_inbox_sees_seeker_opposite():
    seeker = _register("job_seeker")
    recruiter = _register("recruiter")

    with TestClient(create_app()) as c:
        convo_id = c.post(
            "/api/messages", json={"user_id": seeker["user_id"]}, headers=recruiter["headers"]
        ).json()["id"]
        # Recruiter-initiated threads still orient seeker/recruiter correctly.
        assert c.get(f"/api/messages/{convo_id}", headers=recruiter["headers"]).json()[
            "seeker_id"
        ] == seeker["user_id"]
