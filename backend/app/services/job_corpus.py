"""Curated job corpus for Job Match.

These are representative open roles the team of one can maintain by hand —
each job names the skills that appear in its description, so both the
skill-overlap matcher and the embedding/TF-IDF similarity matchers agree.
`required_skills` are must-haves, `preferred_skills` are nice-to-haves
(both use canonical names from `skill_catalog.SKILLS`).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Job:
    job_id: str
    title: str
    company: str
    location: str
    remote: bool
    salary_min: int
    salary_max: int
    category: str  # matches RADAR_AREAS so skills roll up consistently
    description: str
    required_skills: tuple[str, ...]
    preferred_skills: tuple[str, ...] = ()


JOBS: tuple[Job, ...] = (
    # --- Frontend ---
    Job(
        "sr-frontend-linear",
        "Senior Frontend Engineer",
        "Linear",
        "Remote (US/EU)",
        True,
        150_000,
        210_000,
        "Frontend",
        "Own the web app's most visible surfaces. React, TypeScript, Tailwind and a "
        "design system in daily use; we ship small PRs continuously.",
        ("React", "TypeScript", "Tailwind CSS", "GraphQL", "Web Accessibility"),
        ("Next.js", "Redux", "Design Systems"),
    ),
    Job(
        "frontend-figma",
        "Frontend Engineer",
        "Figma",
        "London, UK",
        False,
        130_000,
        180_000,
        "Frontend",
        "Build performant React features for a realtime collaboration product. "
        "Strong TypeScript and a11y practice expected.",
        ("React", "TypeScript", "Web Accessibility", "REST APIs"),
        ("GraphQL", "WebSockets", "Redux"),
    ),
    Job(
        "product-engineer-notion",
        "Product Engineer",
        "Notion",
        "Remote",
        True,
        140_000,
        190_000,
        "Product",
        "Full-stack product engineer: prototype fast in React, then harden with Node "
        "and Postgres. Comfort presenting trade-offs to PMs is a plus.",
        ("React", "TypeScript", "Node.js", "SQL"),
        ("Python", "Product Strategy", "Agile/Scrum"),
    ),

    # --- Backend ---
    Job(
        "sr-backend-supabase",
        "Senior Backend Engineer",
        "Supabase",
        "Remote",
        True,
        145_000,
        200_000,
        "Backend",
        "High-throughput Postgres-backed APIs in TypeScript/Deno. Kafka for event "
        "streams, Redis for cache, and rigorous SQL review.",
        ("SQL", "NoSQL", "Message Queues", "REST APIs", "Microservices"),
        ("Node.js", "TypeScript", "Docker"),
    ),
    Job(
        "backend-stripe",
        "Backend Engineer, Core APIs",
        "Stripe",
        "Dublin, IE",
        False,
        155_000,
        225_000,
        "Backend",
        "Design and operate the API tier that processes millions of requests. "
        "Java/Python, distributed systems, and an obsession with reliability.",
        ("Java", "Python", "Microservices", "System Design", "SQL"),
        ("gRPC", "Docker", "Kubernetes"),
    ),
    Job(
        "platform-engineer",
        "Platform Engineer",
        "Railway",
        "Remote",
        True,
        150_000,
        205_000,
        "DevOps",
        "Build the PaaS that hosts other people's apps: Kubernetes, Terraform, "
        "CI/CD and observability at the core.",
        ("Kubernetes", "Docker", "Terraform", "CI/CD", "AWS", "Monitoring"),
        ("Go", "Linux", "Cloud Architecture"),
    ),
    Job(
        "sre-cloudflare",
        "Site Reliability Engineer",
        "Cloudflare",
        "Lisbon, PT",
        False,
        140_000,
        195_000,
        "DevOps",
        "Keep the edge fast and available. Linux internals, Prometheus/Grafana "
        "dashboards, and on-call discipline.",
        ("Linux", "Monitoring", "Cloud Architecture", "CI/CD"),
        ("Go", "Python", "Kubernetes", "AWS"),
    ),
    Job(
        "sr-go-rabbit",
        "Senior Go Engineer",
        "Convoy",
        "Berlin, DE",
        False,
        135_000,
        185_000,
        "Backend",
        "Grow a Go monolith into clean services. gRPC, Postgres, and message "
        "queues power a logistics marketplace.",
        ("Go", "gRPC", "SQL", "Message Queues", "Microservices"),
        ("Docker", "System Design", "Redis"),
    ),

    # --- DevOps / Cloud ---
    Job(
        "devops-aws-mid",
        "DevOps Engineer",
        "Sentry",
        "Remote",
        True,
        120_000,
        165_000,
        "DevOps",
        "Own AWS infrastructure for a high-traffic SaaS. Terraform, Kubernetes, "
        "and a metrics-driven team culture.",
        ("AWS", "Terraform", "Kubernetes", "CI/CD", "Linux", "Monitoring"),
        ("Python", "Docker", "GCP"),
    ),
    Job(
        "cloud-infra-google",
        "Cloud Infrastructure Engineer",
        "Mux",
        "Remote",
        True,
        145_000,
        200_000,
        "DevOps",
        "GCP-first streaming infrastructure. Serverless, container orchestration, "
        "and incident review that actually moves the needle.",
        ("GCP", "Docker", "Kubernetes", "Cloud Architecture", "Monitoring"),
        ("Go", "Terraform", "Linux"),
    ),

    # --- Data ---
    Job(
        "ml-engineer-hf",
        "Machine Learning Engineer",
        "Hugging Face",
        "Remote",
        True,
        150_000,
        215_000,
        "Data",
        "Productionize LLM-powered features. Python, PyTorch, RAG pipelines and "
        "vector databases are our daily bread.",
        ("Python", "Machine Learning", "LLMs", "Python Data"),
        ("Docker", "AWS", "REST APIs"),
    ),
    Job(
        "data-engineer-snowflake",
        "Data Engineer",
        "Snowflake",
        "Austin, TX",
        False,
        135_000,
        185_000,
        "Data",
        "Design warehouses and batch pipelines that analysts trust. Airflow, dbt, "
        "Spark and SQL underpin everything.",
        ("SQL", "Data Engineering", "Python", "Databases"),
        ("Data Analysis", "AWS", "Docker"),
    ),
    Job(
        "data-analyst-airtable",
        "Data Analyst",
        "Airtable",
        "New York, NY",
        False,
        110_000,
        150_000,
        "Data",
        "Turn product telemetry into decisions. SQL, A/B testing, and crisp "
        "stakeholder storytelling every week.",
        ("SQL", "Data Analysis", "Python"),
        ("Databases", "Stakeholder Management", "Machine Learning"),
    ),

    # --- Product / Leadership ---
    Job(
        "tech-lead-shopify",
        "Technical Lead",
        "Shopify",
        "Toronto, CA",
        False,
        175_000,
        230_000,
        "Product",
        "Lead a squad shipping merchant-facing features. Ruby/Rails and React with "
        "mentoring, planning, and cross-team coordination.",
        ("Technical Leadership", "Agile/Scrum", "React", "Stakeholder Management"),
        ("Project Management", "GraphQL", "TypeScript"),
    ),
    Job(
        "staff-engineer-vercel",
        "Staff Software Engineer",
        "Vercel",
        "Berlin, DE",
        False,
        190_000,
        250_000,
        "Product",
        "Define architecture across the web platform. React, Node, edge computing, "
        "and a mandate to raise the whole org's bar.",
        ("React", "TypeScript", "System Design", "Technical Leadership", "Cloud Architecture"),
        ("Node.js", "Docker", "GraphQL"),
    ),

    # --- Design ---
    Job(
        "design-systems-figma",
        "Design Systems Engineer",
        "Figma",
        "Remote",
        True,
        140_000,
        190_000,
        "Design",
        "Code the tokens, components and docs our designers build on. React, "
        "TypeScript, and strong design-token governance.",
        ("Design Systems", "React", "TypeScript", "UI/UX Design"),
        ("Web Accessibility", "Figma", "Tailwind CSS"),
    ),
    Job(
        "ux-engineer-linear",
        "UX Engineer",
        "Linear",
        "Remote",
        True,
        135_000,
        185_000,
        "Design",
        "A bridge role: prototyping in Figma, production polish in React, and a "
        "razor-sharp sense of interaction craft.",
        ("Figma", "UI/UX Design", "Prototyping", "React", "TypeScript"),
        ("Design Systems", "Tailwind CSS"),
    ),

    # --- Data / AI product (bridges categories) ---
    Job(
        "ai-product-engineer",
        "AI Product Engineer",
        "Anthropic",
        "San Francisco, CA",
        False,
        220_000,
        320_000,
        "Product",
        "Build features on top of frontier LLMs. Python, TypeScript, and a working "
        "feel for eval-driven product development.",
        ("Python", "TypeScript", "LLMs", "REST APIs"),
        ("React", "Product Strategy", "Data Analysis"),
    ),
    Job(
        "fullstack-gh",
        "Full-Stack Engineer",
        "GitHub",
        "Remote (US)",
        True,
        160_000,
        210_000,
        "Backend",
        "Ship across Rails, React, and MySQL at massive scale. Strong code review "
        "and a bias for incremental, safe shipping.",
        ("React", "TypeScript", "SQL", "REST APIs", "CI/CD"),
        ("Ruby", "GraphQL", "Microservices"),
    ),
)

BY_ID: dict[str, Job] = {j.job_id: j for j in JOBS}
