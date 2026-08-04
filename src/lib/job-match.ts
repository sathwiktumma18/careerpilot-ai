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
