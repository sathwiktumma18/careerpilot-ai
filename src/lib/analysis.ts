/**
 * The `Analysis` domain contract — the stable shape every consumer depends on
 * (store, routes, services, PDF export, tests). The backend returns the same
 * data snake_cased over the wire; `analysis-mapper.ts` bridges the two.
 * Changing this shape ripples across routes, so keep it deliberate.
 */

export type SkillScore = { name: string; level: number };
export type MissingSkill = { name: string; importance: "High" | "Medium" | "Low"; reason: string };
export type Suggestion = { title: string; detail: string; severity: "high" | "medium" | "low" };
export type RoleMatch = { role: string; company: string; location: string; match: number };
export type TrendPoint = { month: string; score: number };
export type RadarPoint = { area: string; value: number };
export type ScoreBreakdown = { label: string; score: number };

export type Candidate = {
  name: string;
  title: string;
  location: string;
  email: string;
  yearsExperience: number;
};

export type Analysis = {
  id: string;
  fileName: string;
  uploadedAt: string;
  atsScore: number;
  candidate: Candidate;
  summary: string;
  scoreBreakdown: ScoreBreakdown[];
  detectedSkills: SkillScore[];
  missingSkills: MissingSkill[];
  suggestions: Suggestion[];
  recommendedRoles: RoleMatch[];
  keywordTrend: TrendPoint[];
  skillsRadar: RadarPoint[];
  /** "general" = benchmark vs senior roles; "jd" = scored against a pasted JD. */
  analysisMode?: "general" | "jd";
  targetRole?: string | null;
};

/** Placeholder used while a resume is uploading / before analysis lands. */
export function emptyAnalysis(id: string, fileName: string): Analysis {
  return {
    id,
    fileName,
    uploadedAt: new Date().toISOString(),
    atsScore: 0,
    candidate: {
      name: "Candidate",
      title: "Resume",
      location: "",
      email: "",
      yearsExperience: 0,
    },
    summary: "Your resume is being analyzed. This takes a few seconds.",
    scoreBreakdown: [],
    detectedSkills: [],
    missingSkills: [],
    suggestions: [],
    recommendedRoles: [],
    keywordTrend: [],
    skillsRadar: [],
  };
}
