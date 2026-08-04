"""Shared test fixtures."""

SAMPLE_RESUME = """\
JANE DOE
jane.doe@gmail.com | Bengaluru, IN | +91 9000000000

SENIOR FULL-STACK ENGINEER

SUMMARY
Full-stack engineer with 6 years of experience building React and Node.js
applications at scale.

SKILLS
React, TypeScript, Node.js, Python, PostgreSQL, Docker, AWS, GraphQL, Jest

EXPERIENCE

Acme Corp - Senior Software Engineer
Jan 2021 - Present
- Reduced API latency by 38% for a platform serving 2M monthly users.
- Led a team of 4 engineers; introduced CI/CD with GitHub Actions.
- Designed microservices architecture using Kafka for event streaming.

Beta Labs - Software Engineer
Jun 2019 - Dec 2020
- Built a billing system processing $12M/year with Python and Django.
- Migrated legacy monolith to PostgreSQL and Redis.

EDUCATION
B.Tech Computer Science, 2015 - 2019

PROJECTS
- Open-source dashboard: React + TypeScript + Tailwind
"""


def resume_pdf_bytes() -> bytes:
    from app.services.pdf_parser import make_test_pdf

    return make_test_pdf(SAMPLE_RESUME)
