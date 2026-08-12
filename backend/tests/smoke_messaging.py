"""End-to-end check of messaging + recruiter candidate flow (TestClient).

Verifies the seeker <-> recruiter journey against a fresh SQLite DB:
register both roles -> seeker sees recruiter directory -> seeker opens a thread
-> sends -> recruiter inbox shows unread -> recruiter reads (clears unread) ->
recruiter candidate detail carries the thread id for deep-linking.
"""
import os
import sys
import uuid

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND_DIR)

SMOKE_DB = os.path.join(BACKEND_DIR, "data", "smoke_messaging.db").replace(os.sep, "/")
# Fresh DB every run — migrations run in the app lifespan.
if os.path.exists(SMOKE_DB):
    os.remove(SMOKE_DB)
os.environ["DATABASE_URL"] = f"sqlite:///{SMOKE_DB}"
os.environ["GEMINI_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.pdf_parser import make_test_pdf  # noqa: E402

app = create_app()
c = TestClient(app)
with c:  # run lifespan (Alembic migrations) before the checks
    _client = c


def bail(msg):
    print(f"[FAIL] {msg}")
    sys.exit(1)


def register(name, email, password, role):
    r = c.post("/api/auth/register", json={"name": name, "email": email, "password": password, "role": role})
    if r.status_code != 201:
        bail(f"register {email}: {r.status_code} {r.text[:200]}")
    body = r.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


seeker_id, seeker_h = register("Sara Seeker", f"sara-{uuid.uuid4().hex[:6]}@s.com", "password123", "job_seeker")
recruiter_id, recruiter_h = register("Rita Recruiter", f"rita-{uuid.uuid4().hex[:6]}@r.com", "password123", "recruiter")
print("[PASS] register seeker + recruiter")

# 1. Seeker lists recruiters
r = c.get("/api/recruiters", headers=seeker_h)
assert r.status_code == 200, r.text
recruiters = r.json()
assert any(x["user_id"] == recruiter_id for x in recruiters), "seeker should see the recruiter in the directory"
print("[PASS] seeker sees recruiter directory")

# 2. Seeker opens a thread (get-or-create)
r = c.post("/api/messages", headers=seeker_h, json={"user_id": recruiter_id})
assert r.status_code == 200, r.text
convo_id = r.json()["id"]
assert r.json()["recruiter_name"] == "Rita Recruiter"
print("[PASS] seeker opens thread")

# 3. Same open is idempotent (get-or-create)
r2 = c.post("/api/messages", headers=seeker_h, json={"user_id": recruiter_id})
assert r2.json()["id"] == convo_id, "opening twice must return the same thread"
print("[PASS] thread get-or-create is idempotent")

# 4. Seeker sends a message
r = c.post(f"/api/messages/{convo_id}", headers=seeker_h, json={"body": "Hello! I saw your profile."})
assert r.status_code == 201, r.text
msg_id = r.json()["id"]
print("[PASS] seeker sends message")

# 5. Recruiter inbox shows unread count
r = c.get("/api/messages", headers=recruiter_h)
assert r.status_code == 200, r.text
inbox = r.json()
assert any(x["id"] == convo_id and x["unread_count"] == 1 and x["preview"] == "Hello! I saw your profile." for x in inbox), inbox
print("[PASS] recruiter inbox unread = 1 with preview")

# 6. Recruiter reads the thread -> clears unread
r = c.get(f"/api/messages/{convo_id}", headers=recruiter_h)
assert r.status_code == 200, r.text
assert r.json()["messages"][0]["read"] is True
print("[PASS] recruiter reading clears unread")

# 7. Seeker side now sees 0 unread
r = c.get("/api/messages", headers=seeker_h)
inbox = r.json()
assert next(x for x in inbox if x["id"] == convo_id)["unread_count"] == 0
print("[PASS] unread cleared for both sides")

# 7b. Seeker becomes a tracked candidate: upload + analyze a resume.
RESUME_TEXT = """
Sara Seeker
Frontend Developer
sara@example.com · Bengaluru, India

SUMMARY
Frontend engineer building React apps with TypeScript.

SKILLS
React, TypeScript, Tailwind CSS, Jest, Git
"""
pdf = make_test_pdf(RESUME_TEXT)
r = c.post("/api/resumes", headers=seeker_h, files={"file": ("sara.pdf", pdf, "application/pdf")})
assert r.status_code == 201, r.text
resume_id = r.json()["id"]
r = c.post(f"/api/resumes/{resume_id}/analyze", headers=seeker_h, timeout=120)
assert r.status_code == 200, f"analyze {r.status_code} {r.text[:200]}"
print("[PASS] seeker uploaded + analyzed resume (now a tracked candidate)")

# 8. Recruiter candidate detail carries conversation_id for deep-linking
r = c.get(f"/api/recruiter/candidates/{seeker_id}", headers=recruiter_h)
assert r.status_code == 200, r.text
assert r.json()["conversation_id"] == convo_id, r.text
print("[PASS] candidate detail has conversation_id")

# 9. Ownership: seeker cannot fetch a random thread
r = c.get("/api/messages/does-not-exist", headers=seeker_h)
assert r.status_code == 404
print("[PASS] foreign thread 404s (no existence disclosure)")

# 10. Same-role messaging is rejected
r = c.post("/api/messages", headers=seeker_h, json={"user_id": seeker_id})
assert r.status_code == 400, r.text
print("[PASS] same-role messaging rejected")

# 11. Recruiter cannot see seeker modules via candidate ownership checks
r = c.get(f"/api/recruiter/candidates/{recruiter_id}", headers=recruiter_h)
assert r.status_code == 404, r.text
print("[PASS] non-candidate recruiter id 404s")

print("\nALL MESSAGING SMOKE CHECKS PASS")
