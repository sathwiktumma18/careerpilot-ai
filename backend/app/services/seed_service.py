"""Seed the database with demo recruiter accounts on first boot.

Recruiters are real users with real profiles — they appear in the
recruiter directory, have their own public portfolio pages, and receive
messages from job seekers. Without at least one recruiter the directory is
empty and the whole recruiter half of the product looks dead, so we seed a
small set the first time the DB has no recruiter rows.

Seeded accounts use the password "demo1234" and are clearly demo data —
they're here so the product is testable out of the box, not as a production
fixture. Delete or override them in a real deployment.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import ROLE_RECRUITER, User
from app.services.auth_service import hash_password
from app.services.profile_service import apply_update
from app.schemas.profile import ProfileUpdate

logger = logging.getLogger(__name__)

# (name, email, headline, location, bio, company, company_role, years_exp)
_SEED_RECRUITERS: list[tuple[str, str, str, str, str, str, str, int]] = [
    (
        "Priya Nair",
        "priya.nair@careerpilot demo",
        "Senior Talent Partner · Backend",
        "Bengaluru, Karnataka",
        "I source backend and platform engineers for fast-growing Indian SaaS. "
        "I read resumes for a living — happy to share what I look for.",
        "Kriyash",
        "Senior Talent Partner",
        8,
    ),
    (
        "Rohan Mehta",
        "rohan.mehta@careerpilot demo",
        "Engineering Manager · FinTech",
        "Mumbai, Maharashtra",
        "Building engineering teams at a payments company. Looking for senior "
        "backend and platform engineers with production experience.",
        "Ledgerly",
        "Engineering Manager",
        10,
    ),
    (
        "Ananya Das",
        "ananya.das@careerpilot demo",
        "Recruiter · Product & Design",
        "Hyderabad, Telangana",
        "Recruiting product managers, UX designers, and design systems engineers "
        "for a B2B SaaS company in Hyderabad.",
        "CloudHatch",
        "Talent Acquisition Lead",
    6,
    ),
]


def _strip_demo_email(email: str) -> str:
    return email.replace(" demo", "")


def seed_recruiters() -> int:
    """Create demo recruiter accounts if none exist. Returns count created."""
    db: Session = next(get_db())
    try:
        existing = db.scalar(
            __import__("sqlalchemy").select(User).where(User.role == ROLE_RECRUITER)
        )
        if existing is not None:
            return 0

        created = 0
        for (name, email, headline, location, bio, company, company_role, years_exp) in _SEED_RECRUITERS:
            real_email = _strip_demo_email(email)
            user = User(
                email=real_email,
                name=name,
                password_hash=hash_password("demo1234"),
                role=ROLE_RECRUITER,
            )
            db.add(user)
            db.flush()
            apply_update(
                db,
                user,
                ProfileUpdate(
                    name=name,
                    headline=headline,
                    location=location,
                    bio=bio,
                    company=company,
                    company_role=company_role,
                    years_experience=years_exp,
                ),
            )
            created += 1
        db.commit()
        logger.info("Seeded %d demo recruiter accounts", created)
        return created
    except Exception:
        db.rollback()
        logger.exception("Recruiter seeding failed")
        return 0
    finally:
        db.close()