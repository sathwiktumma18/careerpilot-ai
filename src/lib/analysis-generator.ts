/**
 * Deterministic analysis generator.
 * Given a resume id + file name, produces a realistic, reproducible ATS analysis.
 * Backend can replace this with real AI output — the shape (`Analysis`) is stable.
 */

export type SkillScore = { name: string; level: number };
export type MissingSkill = { name: string; importance: "High" | "Medium" | "Low"; reason: string };
export type Suggestion = { title: string; detail: string; severity: "high" | "medium" | "low" };
export type RoleMatch = { role: string; company: string; location: string; match: number };
export type TrendPoint = { month: string; score: number };
export type RadarPoint = { area: string; value: number };
export type ScoreBreakdown = { label: string; score: number };

export type Analysis = {
  id: string;
  fileName: string;
  uploadedAt: string;
  atsScore: number;
  candidate: {
    name: string;
    title: string;
    location: string;
    email: string;
    yearsExperience: number;
  };
  summary: string;
  scoreBreakdown: ScoreBreakdown[];
  detectedSkills: SkillScore[];
  missingSkills: MissingSkill[];
  suggestions: Suggestion[];
  recommendedRoles: RoleMatch[];
  keywordTrend: TrendPoint[];
  skillsRadar: RadarPoint[];
};

/* -------------------------------- utilities -------------------------------- */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* --------------------------------- catalog --------------------------------- */

const SKILL_POOL = [
  "React", "TypeScript", "Node.js", "Python", "PostgreSQL", "MongoDB", "AWS",
  "GCP", "Docker", "Kubernetes", "GraphQL", "REST APIs", "Tailwind CSS",
  "Next.js", "Redis", "Kafka", "Terraform", "CI/CD", "System Design",
  "Distributed Systems", "Go", "Rust", "Jest", "Playwright", "Figma",
];

const ROLE_TEMPLATES = [
  { role: "Senior Full-Stack Engineer", company: "Linear", location: "Remote" },
  { role: "Staff Software Engineer", company: "Vercel", location: "Berlin" },
  { role: "Platform Engineer", company: "Stripe", location: "Dublin" },
  { role: "Product Engineer", company: "Notion", location: "Remote" },
  { role: "Frontend Architect", company: "Figma", location: "London" },
  { role: "Backend Engineer", company: "Supabase", location: "Remote" },
  { role: "Infrastructure Engineer", company: "Cloudflare", location: "Lisbon" },
  { role: "AI Engineer", company: "OpenAI", location: "San Francisco" },
];

const TITLES = [
  "Senior Full-Stack Engineer",
  "Staff Software Engineer",
  "Frontend Lead",
  "Platform Engineer",
  "Product Engineer",
  "Backend Engineer",
];

const LOCATIONS = ["Berlin, DE", "Remote", "London, UK", "Amsterdam, NL", "Lisbon, PT", "New York, US"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const SUGGESTION_BANK: Suggestion[] = [
  { title: "Quantify your impact", detail: "Add measurable outcomes to your top bullets — revenue lift, latency reduction, or user growth.", severity: "high" },
  { title: "Front-load senior keywords", detail: "Rework the summary so 'systems design', 'mentorship', and 'reliability' appear in the first two lines.", severity: "medium" },
  { title: "Trim early-career section", detail: "Condense pre-2020 experience to a single line per role to stay under 1.5 pages.", severity: "low" },
  { title: "Add a projects section", detail: "Surface 2 open-source or side projects to strengthen the platform-engineering angle.", severity: "medium" },
  { title: "Tighten formatting", detail: "Unify bullet punctuation and use a single date format across all roles.", severity: "low" },
  { title: "Highlight leadership", detail: "Call out team size, cross-team collaboration, and hiring impact where relevant.", severity: "high" },
  { title: "Add measurable KPIs", detail: "Attach concrete metrics (%, ms, $) to at least 60% of your bullets.", severity: "medium" },
];

/* --------------------------------- builder --------------------------------- */

function titleCaseFromFilename(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean).slice(0, 3);
  if (!parts.length) return "Candidate";
  return parts
    .map((p) => (p.length <= 2 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

export function generateAnalysis(id: string, fileName: string): Analysis {
  const rand = seeded(hash(id + "::" + fileName));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const pickN = <T,>(arr: T[], n: number) => {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    }
    return out;
  };

  const atsScore = clamp(Math.round(55 + rand() * 40), 55, 96);

  const detected = pickN(SKILL_POOL, 8).map((name) => ({
    name,
    level: clamp(Math.round(60 + rand() * 40), 55, 99),
  }));
  const usedSkillNames = new Set(detected.map((s) => s.name));
  const missingPool = SKILL_POOL.filter((s) => !usedSkillNames.has(s));
  const missingSkills: MissingSkill[] = pickN(missingPool, 4).map((name, i) => ({
    name,
    importance: (["High", "Medium", "Low", "Medium"] as const)[i] ?? "Medium",
    reason: pick([
      "Common in senior roles you target.",
      `Referenced in ${3 + Math.floor(rand() * 7)}/10 matched job posts.`,
      "Signals staff-track readiness.",
      "Frequently paired with your top skills.",
    ]),
  }));

  const suggestions = pickN(SUGGESTION_BANK, 4);

  const recommendedRoles: RoleMatch[] = pickN(ROLE_TEMPLATES, 4)
    .map((r) => ({ ...r, match: clamp(Math.round(70 + rand() * 28), 70, 98) }))
    .sort((a, b) => b.match - a.match);

  const keywordTrend: TrendPoint[] = MONTHS.map((month, i) => ({
    month,
    score: clamp(Math.round(atsScore - 20 + i * 3 + (rand() - 0.5) * 6), 40, 100),
  }));

  const skillsRadar: RadarPoint[] = [
    "Frontend", "Backend", "DevOps", "Product", "Leadership", "Design",
  ].map((area) => ({ area, value: clamp(Math.round(55 + rand() * 45), 50, 99) }));

  const scoreBreakdown: ScoreBreakdown[] = [
    { label: "Formatting", score: clamp(Math.round(atsScore + (rand() - 0.3) * 15), 50, 99) },
    { label: "Keywords", score: clamp(Math.round(atsScore + (rand() - 0.6) * 20), 45, 98) },
    { label: "Experience", score: clamp(Math.round(atsScore + (rand() - 0.2) * 12), 55, 99) },
    { label: "Education", score: clamp(Math.round(atsScore + (rand() - 0.1) * 10), 60, 99) },
    { label: "Impact", score: clamp(Math.round(atsScore + (rand() - 0.7) * 18), 40, 95) },
  ];

  const candidateName = titleCaseFromFilename(fileName);
  const yearsExperience = 2 + Math.floor(rand() * 10);
  const title = pick(TITLES);
  const location = pick(LOCATIONS);

  const topSkills = detected.slice(0, 3).map((s) => s.name).join(", ");
  const summary =
    `${title} with ${yearsExperience} years of experience shipping production software. ` +
    `Strong in ${topSkills}. Track record of leading initiatives, mentoring engineers, and ` +
    `translating product goals into measurable outcomes. Ready for senior IC or tech-lead scope.`;

  return {
    id,
    fileName,
    uploadedAt: new Date().toISOString(),
    atsScore,
    candidate: {
      name: candidateName,
      title,
      location,
      email: `${candidateName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      yearsExperience,
    },
    summary,
    scoreBreakdown,
    detectedSkills: detected,
    missingSkills,
    suggestions,
    recommendedRoles,
    keywordTrend,
    skillsRadar,
  };
}
