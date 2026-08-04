"""Skill catalog shared by the no-key analyzer and the LLM prompts.

Detection is alias-based: each skill carries the alternative spellings /
technologies that should count as evidence of it in a resume's text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Radar / breakdown areas — skill categories roll up into these.
RADAR_AREAS = ("Frontend", "Backend", "DevOps", "Data", "Product", "Design")


@dataclass(frozen=True)
class SkillDef:
    name: str
    category: str  # must be one of RADAR_AREAS
    aliases: tuple[str, ...]


SKILLS: tuple[SkillDef, ...] = (
    # Frontend
    SkillDef("React", "Frontend", ("react", "react.js", "reactjs")),
    SkillDef("TypeScript", "Frontend", ("typescript", "ts +",)),
    SkillDef("JavaScript", "Frontend", ("javascript", "es6", "es2015")),
    SkillDef("Next.js", "Frontend", ("next.js", "nextjs", "next js")),
    SkillDef("Tailwind CSS", "Frontend", ("tailwind", "tailwindcss")),
    SkillDef("Vue.js", "Frontend", ("vue", "vue.js", "vuejs")),
    SkillDef("Angular", "Frontend", ("angular", "angularjs")),
    SkillDef("HTML5/CSS3", "Frontend", ("html5", "html 5", "css3", "css 3", "flexbox", "grid")),
    SkillDef("Redux", "Frontend", ("redux",)),
    SkillDef("GraphQL", "Frontend", ("graphql",)),
    SkillDef("Web Accessibility", "Frontend", ("a11y", "wcag", "accessibility")),
    # Backend
    SkillDef("Node.js", "Backend", ("node.js", "nodejs", "node js", "express", "nestjs")),
    SkillDef("Python", "Backend", ("python", "django", "flask", "fastapi")),
    SkillDef("Go", "Backend", ("golang", " go ")),
    SkillDef("Java", "Backend", ("java",)),
    SkillDef("Rust", "Backend", ("rust",)),
    SkillDef("REST APIs", "Backend", ("rest api", "restful", "rest apis")),
    SkillDef("Microservices", "Backend", ("microservice", "distributed systems")),
    SkillDef("System Design", "Backend", ("system design", "architecture design", "scalable architecture")),
    SkillDef("Message Queues", "Backend", ("kafka", "rabbitmq", "sqs", "pub/sub", "pubsub")),
    SkillDef("SQL", "Backend", ("sql", "postgresql", "mysql", "postgres")),
    SkillDef("NoSQL", "Backend", ("nosql", "mongodb", "redis", "dynamodb")),
    SkillDef("WebSockets", "Backend", ("websocket", "socket.io", "socketio")),
    SkillDef("gRPC", "Backend", ("grpc", "protobuf")),
    # DevOps / Cloud
    SkillDef("Docker", "DevOps", ("docker", "containerization", "containers")),
    SkillDef("Kubernetes", "DevOps", ("kubernetes", "k8s")),
    SkillDef("AWS", "DevOps", ("aws", "amazon web services", "ec2", "lambda", "s3")),
    SkillDef("GCP", "DevOps", ("gcp", "google cloud", "google cloud platform")),
    SkillDef("Azure", "DevOps", ("azure",)),
    SkillDef("CI/CD", "DevOps", ("ci/cd", "ci cd", "github actions", "gitlab ci", "jenkins")),
    SkillDef("Terraform", "DevOps", ("terraform", "infrastructure as code", "iac")),
    SkillDef("Monitoring", "DevOps", ("prometheus", "grafana", "datadog", "new relic", "sentry")),
    SkillDef("Linux", "DevOps", ("linux", "unix", "bash", "shell scripting")),
    SkillDef("Cloud Architecture", "DevOps", ("cloud architecture", "cloud native", "serverless")),
    # Data
    SkillDef("Python Data", "Data", ("pandas", "numpy", "scikit-learn", "scikit learn")),
    SkillDef("Machine Learning", "Data", ("machine learning", "deep learning", "tensorflow", "pytorch", "keras")),
    SkillDef("LLMs", "Data", ("llm", "large language model", "gpt", "rag", "vector database", "embeddings")),
    SkillDef("Data Engineering", "Data", ("data engineering", "airflow", "spark", "dbt", "etl", "databricks")),
    SkillDef("Data Analysis", "Data", ("data analysis", "analytics", "statistical", "a/b testing", "ab testing")),
    SkillDef("Databases", "Data", ("database", "data warehouse", "snowflake", "bigquery")),
    # Product / Leadership
    SkillDef("Product Strategy", "Product", ("product strategy", "roadmap", "product management")),
    SkillDef("Agile/Scrum", "Product", ("agile", "scrum", "sprint", "kanban")),
    SkillDef("Technical Leadership", "Product", ("tech lead", "technical lead", "mentor", "mentoring", "leadership")),
    SkillDef("Stakeholder Management", "Product", ("stakeholder", "cross-functional", "cross functional")),
    SkillDef("Project Management", "Product", ("project management", "program management")),
    # Design
    SkillDef("UI/UX Design", "Design", ("ui/ux", "ui design", "ux design", "user experience", "user interface")),
    SkillDef("Figma", "Design", ("figma",)),
    SkillDef("Design Systems", "Design", ("design system", "design tokens")),
    SkillDef("Prototyping", "Design", ("prototyping", "wireframe", "interactive prototype")),
)

# Lookup for prompts / analysis: normalized alias -> SkillDef
ALIAS_TO_SKILL: dict[str, SkillDef] = {}
for _skill in SKILLS:
    for _alias in _skill.aliases:
        ALIAS_TO_SKILL[_alias.strip().lower()] = _skill
# Canonical names also match themselves.
for _skill in SKILLS:
    ALIAS_TO_SKILL[_skill.name.lower()] = _skill


def normalize_name(name: str) -> str:
    """Best-effort: map an arbitrary string to a canonical catalog skill name.

    Returns the input unchanged when nothing in the catalog matches, so callers
    can rely on the return being a plain name string.
    """
    skill = ALIAS_TO_SKILL.get(name.strip().lower())
    return skill.name if skill else name


def skills_in_category(category: str) -> list[str]:
    return [s.name for s in SKILLS if s.category == category]


def alias_pattern(alias: str) -> str:
    """Regex for a word-boundary text match of one skill alias (case-insensitive).

    Shared by the fallback analyzer and the Job Match skill detector so both
    agree on what counts as evidence of a skill.
    """
    return rf"(?<!\w)(?:{re.escape(alias.strip())})(?!\w)"
