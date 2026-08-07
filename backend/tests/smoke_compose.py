"""Manual smoke test against a running docker compose stack.

Run after `docker compose up --build -d` is healthy:

    backend/venv/Scripts/python.exe backend/tests/smoke_compose.py

Checks, against the live Postgres-backed stack:
  1. GET  /health                        -> 200
  2. POST /api/auth/register             -> access_token
  3. GET  /api/auth/me     (Bearer)      -> 200
  4. GET  /api/auth/me     (no token)    -> 401
  5. POST /api/auth/forgot-password      -> reset_token
  6. POST /api/auth/reset-password       -> 200
  7. POST /api/auth/login  (new pass)    -> 200
  8. POST /api/auth/login  (old pass)    -> 401
  9. POST /api/resumes (upload)          -> 201, group + v1
  10. POST /api/resumes/{id}/versions    -> 201, version_no 2
  11. GET  /api/resumes/{id}             -> version_count 2, versions[], view_count 1
  12. GET  /api/resumes/{id} (again)     -> view_count 2 (repeat view counted)
  13. GET  /api/resumes (list)           -> row carries version_count 2 / view_count 2
  14. GET  foreign resume                -> 404 (ownership scoped)
  15. GET  /api/auth/oauth/{provider}/authorize -> 501 (no creds configured)
  16. DELETE /api/resumes/{id}           -> 204, then 404 (cascade)
"""
import os
import sys
import uuid

import httpx

# Make `from app...` importable when run as backend/tests/smoke_compose.py.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.pdf_parser import make_test_pdf  # noqa: E402

BASE = "http://localhost:8000"
OLD_PW = "smoke-old-pass"
NEW_PW = "smoke-new-pass"


def check(name: str, cond: bool, extra: str = "") -> None:
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {extra}" if extra else ""))
    if not cond:
        sys.exit(1)


def main() -> None:
    client = httpx.Client(base_url=BASE, timeout=15.0)
    email = f"smoke-{uuid.uuid4().hex[:10]}@example.com"

    r = client.get("/health")
    check("health 200", r.status_code == 200, r.text[:80])

    r = client.post("/api/auth/register", json={"name": "Smoke Test", "email": email, "password": OLD_PW})
    check("register 201 + token", r.status_code == 201, r.text[:120])
    token = r.json()["access_token"]

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    check("gated /me 200 with token", r.status_code == 200, r.text[:80])

    r = client.get("/api/auth/me")
    check("gated /me 401 without token", r.status_code == 401, str(r.status_code))

    r = client.post("/api/auth/forgot-password", json={"email": email})
    check("forgot 200 + reset_token", r.status_code == 200 and r.json().get("reset_token"), r.text[:80])
    reset_token = r.json()["reset_token"]

    r = client.post("/api/auth/reset-password", json={"email": email, "token": reset_token, "new_password": NEW_PW})
    check("reset 200", r.status_code == 200, r.text[:120])

    r = client.post("/api/auth/login", json={"email": email, "password": NEW_PW})
    check("login new password 200", r.status_code == 200, str(r.status_code))

    r = client.post("/api/auth/login", json={"email": email, "password": OLD_PW})
    check("login old password 401", r.status_code == 401, str(r.status_code))

    # --- Phase 4: resume versioning, analytics, social sign-in ---
    # No AI key needed: these endpoints are DB/file only (analyze is skipped).
    headers = {"Authorization": f"Bearer {token}"}
    pdf = make_test_pdf("Jane Doe\nSoftware Engineer\nPython, FastAPI, React")

    r = client.post(
        "/api/resumes",
        headers=headers,
        files={"file": ("jane_doe.pdf", pdf, "application/pdf")},
    )
    check("upload resume 201", r.status_code == 201, r.text[:120])
    resume_id = r.json()["id"]

    r = client.post(
        f"/api/resumes/{resume_id}/versions",
        headers=headers,
        files={"file": ("jane_doe_v2.pdf", pdf, "application/pdf")},
    )
    check("add version 201 + v2", r.status_code == 201 and r.json().get("version_no") == 2, r.text[:120])

    r = client.get(f"/api/resumes/{resume_id}", headers=headers)
    d = r.json()
    check("detail 200 + version_count 2", r.status_code == 200 and d.get("version_count") == 2, str(d.get("version_count")))
    check("detail current_version_no 2", d.get("current_version_no") == 2, str(d.get("current_version_no")))
    check("detail versions len 2", len(d.get("versions", [])) == 2, str(len(d.get("versions", []))))
    check("detail view_count 1 after first GET", d.get("view_count") == 1, str(d.get("view_count")))

    r = client.get(f"/api/resumes/{resume_id}", headers=headers)
    check("detail view_count 2 after second GET", r.json().get("view_count") == 2, str(r.json().get("view_count")))

    r = client.get("/api/resumes", headers=headers)
    row = next((i for i in r.json() if i.get("id") == resume_id), None)
    check("list row version_count 2", row and row.get("version_count") == 2, str(row))
    check("list row view_count 2", row and row.get("view_count") == 2, str(row))

    r = client.post(
        "/api/auth/register",
        json={"name": "Other User", "email": f"other-{uuid.uuid4().hex[:10]}@example.com", "password": OLD_PW},
    )
    other_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.get(f"/api/resumes/{resume_id}", headers=other_headers)
    check("foreign resume 404 (ownership)", r.status_code == 404, str(r.status_code))

    for provider in ("google", "github"):
        r = client.get(f"/api/auth/oauth/{provider}/authorize")
        check(f"oauth {provider} authorize 501 (no creds)", r.status_code == 501, str(r.status_code))

    r = client.delete(f"/api/resumes/{resume_id}", headers=headers)
    check("delete 204", r.status_code == 204, str(r.status_code))
    r = client.get(f"/api/resumes/{resume_id}", headers=headers)
    check("deleted resume 404 (cascade)", r.status_code == 404, str(r.status_code))

    print("\nAll smoke checks passed against the Postgres-backed stack.")


if __name__ == "__main__":
    main()
