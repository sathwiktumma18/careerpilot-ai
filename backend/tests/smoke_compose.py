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
"""
import sys
import uuid

import httpx

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

    print("\nAll smoke checks passed against the Postgres-backed stack.")


if __name__ == "__main__":
    main()
