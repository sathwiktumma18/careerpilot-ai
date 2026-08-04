/**
 * Maps the backend's snake_cased job-match payload onto the camelCase
 * `JobMatchResponse` domain shape. Mirrors `analysis-mapper.ts`.
 */
import type { JobLite, JobMatchResponse } from "./job-match";

export interface ApiJobMatchResult {
  job_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  bonus_skills: string[];
  summary: string;
  source: "corpus" | "paste";
}

export interface ApiJobMatchResponse {
  resume_id: string;
  resume_title: string;
  detected_skills: string[];
  method: "gemini" | "tfidf";
  results: ApiJobMatchResult[];
}

export interface ApiJobLite {
  job_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary_min: number;
  salary_max: number;
  category: string;
  skills_count: number;
  description: string;
}

export function mapJobMatchFromApi(raw: ApiJobMatchResponse): JobMatchResponse {
  return {
    resumeId: raw.resume_id,
    resumeTitle: raw.resume_title,
    detectedSkills: raw.detected_skills ?? [],
    method: raw.method,
    results: (raw.results ?? []).map((r) => ({
      jobId: r.job_id,
      title: r.title,
      company: r.company,
      location: r.location,
      remote: r.remote,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      matchScore: r.match_score,
      matchedSkills: r.matched_skills ?? [],
      missingSkills: r.missing_skills ?? [],
      bonusSkills: r.bonus_skills ?? [],
      summary: r.summary,
      source: r.source,
    })),
  };
}

export function mapJobLiteFromApi(raw: ApiJobLite): JobLite {
  return {
    jobId: raw.job_id,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    remote: raw.remote,
    salaryMin: raw.salary_min,
    salaryMax: raw.salary_max,
    category: raw.category,
    skillsCount: raw.skills_count,
    description: raw.description,
  };
}
