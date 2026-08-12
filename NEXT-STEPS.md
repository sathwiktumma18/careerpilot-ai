# CareerPilot AI — Next Steps (resume tomorrow: 2026-08-09)

All fixes + improvements the user listed, in the order they asked for them.
**Fixes first, then the UI/UX polish skill.** Work together with the user, verify
each phase in the browser before moving on.

## Where things stand

- ✅ **Bug 1 (resume analysis "failed")** — fixed. `upload()` now upserts the
  record into the store so a follow-up `analyze()` finds it; real errors surface
  instead of the generic message.
- ✅ **Bug 2 ("Something went wrong" on /dashboard)** — fixed. Resume store
  `merge` normalizes stale localStorage snapshots (missing `versions`/`analysis`).
  Regression test: `src/lib/store-rehydrate.test.ts` (16/16 tests pass).
- ✅ **A1 — User roles (backend)** — `users.role` column ("job_seeker" |
  "recruiter"), migration `c4d6e8f0b2e4`, `RegisterRequest`/`UserOut` carry role,
  `get_current_recruiter` gate. Verified live.
- ✅ **A2 — Role-scoped UI** — signup role picker (Job Seeker / Recruiter),
  Sidebar nav is role-aware, demo placeholders ("Alex Morgan", "you@company.com")
  removed. tsc clean, lint clean.
- ✅ **A3 — Seeker intent + recruiter candidate API (backend)** —
  `seeker_activities` table (migration `d5e7f9a1c3e5`); recording hooks on resume
  analyze + job match; `GET /api/recruiter/candidates` (+ detail, 403 for
  seekers), `GET /api/recruiters` directory. E2E verified via TestClient.

### How to run (local dev, SQLite — no Docker needed)
- Backend: `cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload` → http://127.0.0.1:8000
- Frontend: `npm run dev` → http://127.0.0.1:5173
- Migrations auto-run at startup (idempotent).

---

## TODO for tomorrow — in this order

### 🔵 Phase A4 — Messaging backend (NOT started)
Conversation + Message models/migration; endpoints: start a thread
(seeker→recruiter or recruiter→seeker), list my conversations, get/send messages,
unread flags, participant-only ownership. Wire into `/api/messages`.
- Add `Conversation` (id, seeker_id, recruiter_id, created_at, updated_at,
  last_message_at) + `Message` (id, conversation_id, sender_id, body, created_at,
  read_at). Migration. Register in `models/__init__.py`.
- Routes file `routes/messages.py`; register in `main.py`.
- Only the two participants can read the thread (ownership check → 403/404).
- Recruiter candidate detail (`/api/recruiter/candidates/{id}`) should include
  the conversation/messages with that recruiter (join existing thread or null).

### 🔵 Phase A5 — Messaging + Recruiters UI + real recruiter dashboard
- New seeker page **Recruiters** (`/recruiters`): list from `GET /api/recruiters`,
  each card has "Message" → opens/creates thread.
- New **Inbox** page (`/messages` + `/messages/$id`) for both roles.
- Rebuild `/recruiter` route into the **real recruiter dashboard**: candidates
  from `GET /api/recruiter/candidates` (name, headline, ATS, searched roles, last
  active), profile drawer with resume + searched roles + message thread. Remove
  the old "candidate pool from your own resumes" behavior.
- Make `/dashboard` role-aware (recruiters see candidate stats, not resume stats).
- Add the new routes to the role-scoped Sidebar (Recruiters + Inbox for seekers;
  Candidates + Inbox for recruiters). Add `messagesService`/`recruiterService` to
  `src/services/api.ts`.
- **Recruiter sidebar hides all seeker sections** (Resume Analyze / Interview
  Prep / Job Matching / Career Roadmap) — recruiters see ONLY recruiter features.
- **Recruiter gets their own portfolio**, like a normal user's PortfolioAI public
  page — company / role / location / bio / contact, built from their profile.

### 🟢 Phase B — Resume analysis with optional JD
- Backend `/api/resumes/{id}/analyze` accepts optional `job_description` +
  `target_role`; provider prompt + fallback handle both modes.
- Upload page: "Analyze without JD" (current behavior) vs "Paste a JD + choose a
  target role" — score the resume against that specific JD/role and show an ATS
  score for THAT posting. Keep an explicit **"No JD Analyze"** option available.

### 🟢 Phase C — Real jobs (JSearch / RapidAPI)  ← needs a key from the user
- User registers JSearch on RapidAPI (free tier ≈100 req/mo) and gives the key.
- Store key in `backend/.env` as `JSEARCH_API_KEY` (git-ignored). Adapter in
  `backend/app/services/jobs_api.py`; query live postings by title/location,
  filter to posted ≤4 weeks ago, return apply link + posted date + salary +
  location + company; prioritize India jobs. Graceful fallback to the corpus
  when the key is missing/rate-limited.
- JobMatch page shows live jobs with **Apply** buttons after a match/title entry.
- Apply link may be **official OR third-party portal** (user doesn't care which);
  every posting must show its **posted date**. Sources = job-board aggregators
  (Naukri / Indeed / Unstop / Google listings) — **prioritize Indian jobs**.

### 🟢 Phase D — Interview speech input/output
- Browser Web Speech API (free, Chrome): SpeechRecognition for answers (STT),
  speechSynthesis for the AI reading questions aloud (TTS) with a voice picker
  and on/off toggle. Use a **natural human-sounding voice** for TTS (not the
  robotic default) and realistic STT. No backend changes needed.

### 🟢 Phase E — Roadmap typo tolerance
- Normalize/fuzzy-match the user's typed target role against known roles
  (reuse `skill_catalog.normalize_name` style) so misspellings still produce a
  correct roadmap.

### 🟢 Phase F — Settings rebuild
- Replace the workspace/General/AI/Billing/Team/API Keys tabs with **real Account
  settings ONLY** — those tabs were dummy (did nothing when clicked, pre-filled
  "Alex"/alex@gmail.com); remove them entirely, no separate Workspace page.
  New Account settings for the logged-in user (works for both roles): profile
  photo upload (backend file storage), personal + professional details, social
  links (LinkedIn/GitHub/portfolio), wired to the actual user via backend
  persistence. Fields start **empty** — never pre-fill demo data.

### 🟣 Phase G — UI/UX polish
- Create a `.claude/skills/` UI/UX design skill package, then apply a full
  polish pass over the app (dashboard, auth, settings, recruiter, messaging).

---

## Notes / reminders
- **Never commit `backend/.env`** (holds GEMINI_API_KEY + JSEARCH_API_KEY). It is
  git-ignored — double-check before any `git add -A`.
- Git commits end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Backend venv interpreter: `backend/venv/Scripts/python.exe` (global Python
  lacks email_validator). Postgres in docker compose; SQLite is the local default.
- Local test accounts already in the dev DB (harmless, usable for demos):
  `rita@rec.com` / `password123` (recruiter), `sara@s.com` / `password123`
  (seeker).
- JWT secret is the dev default — fine locally, must change in prod.
- Login/signup forms: fields start **empty** with placeholder text ("Enter your
  full name", "Enter your email") — never show demo names/emails.
- Order confirmed by user (2026-08-11): fix these issues first, THEN install a
  dedicated UI/UX design skill and run the full polish pass (Phase G).
