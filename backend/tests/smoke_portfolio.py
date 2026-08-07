"""End-to-end check of the public portfolio against the running Docker stack.

Registers a fresh user, uploads + analyzes a real PDF, then hits the public
portfolio page endpoint (no auth) and the manager endpoint. Prints the share
URLs to deliver to the user.
"""
import os
import sys
import uuid

import httpx

# Make `from app...` importable when run as backend/tests/smoke_portfolio.py.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.pdf_parser import make_test_pdf  # noqa: E402

BASE = "http://127.0.0.1:8000"
client = httpx.Client(base_url=BASE, timeout=30.0)
email = f"demo-{uuid.uuid4().hex[:8]}@example.com"
password = "demo-pass-1234"


def bail(msg):
    print(f"[FAIL] {msg}")
    sys.exit(1)


# 1. Register
r = client.post(
    "/api/auth/register",
    json={"email": email, "password": password, "name": "Demo Candidate"},
)
if r.status_code != 201:
    bail(f"register {r.status_code} {r.text[:200]}")
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("[PASS] register")

# 2. Upload a real PDF
RESUME_TEXT = """
Demo Candidate
Senior Frontend Engineer
demo@example.com · Bengaluru, India · 6 years experience

SUMMARY
Frontend engineer specializing in React, TypeScript and performance. Built
design systems used by 40+ engineers and cut Core Web Vitals by 35%.

EXPERIENCE
Senior Frontend Engineer, Acme Corp (2022 - present)
- Led migration of a 200k-line React codebase to TypeScript.
- Built a reusable component library with Tailwind CSS and Storybook.
- Improved CI with Playwright end-to-end tests, cutting regressions by 40%.

Frontend Engineer, Beta Labs (2020 - 2022)
- Shipped responsive dashboards with React, Redux and D3.js.
- Introduced unit testing with Vitest and React Testing Library.

SKILLS
React, TypeScript, Tailwind CSS, Node.js, GraphQL, Docker, Jest, Git

EDUCATION
B.Tech Computer Science, University of Technology
"""
pdf = make_test_pdf(RESUME_TEXT)
r = client.post(
    "/api/resumes",
    headers=headers,
    files={"file": ("demo_candidate.pdf", pdf, "application/pdf")},
)
if r.status_code != 201:
    bail(f"upload {r.status_code} {r.text[:200]}")
resume_id = r.json()["id"]
print("[PASS] upload")

# 3. Analyze (sync; LLM or offline fallback both produce a real analysis)
r = client.post(f"/api/resumes/{resume_id}/analyze", headers=headers, timeout=120)
if r.status_code != 200:
    bail(f"analyze {r.status_code} {r.text[:200]}")
analysis = r.json()
ats = analysis.get("ats_score")
if not ats:
    bail(f"analysis returned ats_score {ats!r}")
print(f"[PASS] analyze (ATS {ats})")

# 4. Manager route -> slug + path
r = client.get("/api/portfolio/me", headers=headers)
if r.status_code != 200:
    bail(f"portfolio/me {r.status_code} {r.text[:200]}")
me = r.json()
slug = me["slug"]
manager_path = me.get("path")
print(f"[PASS] portfolio/me -> slug {slug!r}, path {manager_path!r}")

# 5. Public endpoint — no token
r = client.get(f"/api/public/portfolio/{slug}")
if r.status_code != 200:
    bail(f"public portfolio {r.status_code} {r.text[:200]}")
data = r.json()
checks = [
    ("slug present", data.get("slug") == slug),
    ("name present", bool(data.get("name"))),
    ("ats_score", data.get("ats_score") is not None),
    ("skills non-empty", bool(data.get("skills"))),
    ("summary non-empty", bool(data.get("summary"))),
    ("resume_file_name", bool(data.get("resume_file_name"))),
    ("updated_at", bool(data.get("updated_at"))),
]
for label, ok in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] public: {label}")
    if not ok:
        bail("public portfolio content incomplete")

# 6. Unknown slug -> 404 (no existence disclosure)
r = client.get(f"/api/public/portfolio/does-not-exist-{uuid.uuid4().hex[:6]}")
if r.status_code != 404:
    bail(f"unknown slug expected 404, got {r.status_code}")

print("\n=== SMOKE PORTFOLIO PASSED — shareable URLs ===")
print(f"Public portfolio : http://localhost:5173{manager_path}")
print(f"Headline         : {data.get('headline')!r}")
print(f"Top skills       : {', '.join(s['name'] for s in data.get('skills', [])[:5])}")
