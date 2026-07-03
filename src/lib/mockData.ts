export const mockAnalysis = {
  fileName: "Alex_Morgan_Resume.pdf",
  uploadedAt: new Date().toISOString(),
  atsScore: 82,
  scoreBreakdown: [
    { label: "Formatting", score: 92 },
    { label: "Keywords", score: 74 },
    { label: "Experience", score: 88 },
    { label: "Education", score: 90 },
    { label: "Impact", score: 68 },
  ],
  summary:
    "Full-stack engineer with 6 years shipping consumer and B2B SaaS products. Strong React and Node.js foundation with a track record of leading migrations, mentoring engineers, and translating product goals into shippable milestones.",
  candidate: {
    name: "Alex Morgan",
    title: "Senior Full-Stack Engineer",
    location: "Berlin, DE",
    email: "alex.morgan@example.com",
    yearsExperience: 6,
  },
  detectedSkills: [
    { name: "React", level: 95 },
    { name: "TypeScript", level: 92 },
    { name: "Node.js", level: 88 },
    { name: "PostgreSQL", level: 80 },
    { name: "AWS", level: 74 },
    { name: "Docker", level: 70 },
    { name: "GraphQL", level: 68 },
    { name: "Tailwind CSS", level: 90 },
  ],
  missingSkills: [
    { name: "Kubernetes", importance: "High", reason: "Common in senior SaaS roles you target." },
    { name: "Terraform", importance: "Medium", reason: "Referenced in 6/10 matched job posts." },
    { name: "System Design", importance: "High", reason: "Signals staff-track readiness." },
    { name: "gRPC", importance: "Low", reason: "Occasional in platform teams." },
  ],
  suggestions: [
    {
      title: "Quantify your impact",
      detail:
        "Add measurable outcomes to 4 bullets under Acme Corp — revenue lift, latency reduction, or user growth.",
      severity: "high",
    },
    {
      title: "Front-load senior keywords",
      detail:
        "Reword the summary to include 'systems design', 'mentorship', and 'platform reliability' in the first 2 lines.",
      severity: "medium",
    },
    {
      title: "Trim early-career section",
      detail: "Condense your 2017 internship to a single line to keep the resume to 1.5 pages.",
      severity: "low",
    },
    {
      title: "Add a projects section",
      detail: "Surface 2 open-source or side projects to strengthen the platform-engineering angle.",
      severity: "medium",
    },
  ],
  recommendedRoles: [
    { role: "Senior Full-Stack Engineer", match: 94, company: "Linear", location: "Remote" },
    { role: "Staff Software Engineer", match: 87, company: "Vercel", location: "Berlin" },
    { role: "Platform Engineer", match: 82, company: "Stripe", location: "Dublin" },
    { role: "Product Engineer", match: 79, company: "Notion", location: "Remote" },
  ],
  keywordTrend: [
    { month: "Jan", score: 62 },
    { month: "Feb", score: 66 },
    { month: "Mar", score: 71 },
    { month: "Apr", score: 74 },
    { month: "May", score: 78 },
    { month: "Jun", score: 82 },
  ],
  skillsRadar: [
    { area: "Frontend", value: 94 },
    { area: "Backend", value: 82 },
    { area: "DevOps", value: 68 },
    { area: "Product", value: 78 },
    { area: "Leadership", value: 72 },
    { area: "Design", value: 65 },
  ],
};

export type Analysis = typeof mockAnalysis;

export const mockDashboardStats = [
  { label: "Resumes Analyzed", value: "24", delta: "+12%", trend: "up" as const },
  { label: "Avg ATS Score", value: "78", delta: "+4 pts", trend: "up" as const },
  { label: "Matched Roles", value: "142", delta: "+31", trend: "up" as const },
  { label: "Interviews Ready", value: "9", delta: "+2", trend: "up" as const },
];

export const mockActivity = [
  { id: 1, action: "Resume analyzed", target: "Alex_Morgan_Resume.pdf", time: "2m ago" },
  { id: 2, action: "New role match", target: "Staff Engineer · Vercel", time: "1h ago" },
  { id: 3, action: "Interview prep completed", target: "System Design · L5", time: "Yesterday" },
  { id: 4, action: "Roadmap milestone", target: "Kubernetes fundamentals", time: "2d ago" },
];
