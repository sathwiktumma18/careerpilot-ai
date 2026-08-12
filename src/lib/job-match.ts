/**
 * Job Match domain types — the stable camelCase shape the UI consumes.
 * The backend returns snake_case over the wire; `job-match-mapper.ts` bridges.
 */

export type MatchMethod = "gemini" | "tfidf";

export type JobMatchResult = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  bonusSkills: string[];
  summary: string;
  source: "corpus" | "paste";
};

export type JobMatchResponse = {
  resumeId: string;
  resumeTitle: string;
  detectedSkills: string[];
  method: MatchMethod;
  results: JobMatchResult[];
};

export type JobLite = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salaryMin: number;
  salaryMax: number;
  category: string;
  skillsCount: number;
  description: string;
};

/** A live posting returned by the JSearch adapter (Phase C). */
export type LiveJob = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: "yearly" | "hourly" | null;
  applyLink: string | null;
  /** ISO-8601 datetime — the posting date, always surfaced. */
  postedAt: string;
  employmentType: string | null;
  india: boolean;
};

export type LiveJobSearchResponse = {
  query: string;
  location: string;
  jobs: LiveJob[];
  /** False when the JSEARCH key is missing or the API failed → show fallback note. */
  available: boolean;
  postedWithinDays: number;
};
