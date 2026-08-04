/**
 * Maps the backend's snake_cased analysis payload onto the camelCase `Analysis`
 * domain shape. Collection fields default to [] so the UI never has to guard
 * against missing keys from an older backend.
 */
import type { Analysis } from "./analysis";

export interface ApiAnalysis {
  id: string;
  file_name: string;
  uploaded_at: string;
  ats_score: number;
  candidate: {
    name: string;
    title: string;
    location: string;
    email: string;
    years_experience: number;
  };
  summary: string;
  score_breakdown: { label: string; score: number }[];
  detected_skills: { name: string; level: number }[];
  missing_skills: { name: string; importance: "High" | "Medium" | "Low"; reason: string }[];
  suggestions: { title: string; detail: string; severity: "high" | "medium" | "low" }[];
  recommended_roles: { role: string; company: string; location: string; match: number }[];
  keyword_trend: { month: string; score: number }[];
  skills_radar: { area: string; value: number }[];
}

export function mapAnalysisFromApi(raw: ApiAnalysis): Analysis {
  return {
    id: raw.id,
    fileName: raw.file_name,
    uploadedAt: raw.uploaded_at,
    atsScore: raw.ats_score,
    candidate: {
      name: raw.candidate.name,
      title: raw.candidate.title,
      location: raw.candidate.location,
      email: raw.candidate.email,
      yearsExperience: raw.candidate.years_experience,
    },
    summary: raw.summary,
    scoreBreakdown: raw.score_breakdown ?? [],
    detectedSkills: raw.detected_skills ?? [],
    missingSkills: raw.missing_skills ?? [],
    suggestions: raw.suggestions ?? [],
    recommendedRoles: raw.recommended_roles ?? [],
    keywordTrend: raw.keyword_trend ?? [],
    skillsRadar: raw.skills_radar ?? [],
  };
}
