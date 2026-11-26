/**
 * Maps the backend's snake_cased job-match payload onto the camelCase
 * `JobMatchResponse` domain shape. Mirrors `analysis-mapper.ts`.
 */
import type { JobLite, JobMatchResponse, LiveJob, LiveJobSearchResponse } from "./job-match";

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
  apply_link: string | null;
  posted_at: string | null;
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

/* ------------------------------ Live jobs (Phase C) ------------------------------ */

export interface ApiLiveJob {
  job_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: "yearly" | "hourly" | null;
  apply_link: string | null;
  posted_at: string;
  employment_type: string | null;
  india: boolean;
}

export interface ApiLiveJobSearchResponse {
  query: string;
  location: string;
  jobs: ApiLiveJob[];
  available: boolean;
  posted_within_days: number;
}

export function mapLiveJobFromApi(raw: ApiLiveJob): LiveJob {
  return {
    jobId: raw.job_id,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    remote: raw.remote,
    salaryMin: raw.salary_min,
    salaryMax: raw.salary_max,
    salaryPeriod: raw.salary_period,
    applyLink: raw.apply_link,
    postedAt: raw.posted_at,
    employmentType: raw.employment_type,
    india: raw.india,
  };
}

export function mapLiveJobSearchFromApi(raw: ApiLiveJobSearchResponse): LiveJobSearchResponse {
  return {
    query: raw.query,
    location: raw.location,
    jobs: (raw.jobs ?? []).map(mapLiveJobFromApi),
    available: raw.available,
    postedWithinDays: raw.posted_within_days,
  };
}
