/**
 * Maps the backend's snake_cased public-portfolio payload onto the camelCase
 * `PortfolioProfile` domain shape. Collections default to [] so the public
 * page never has to guard against missing keys.
 */
import type { PortfolioProfile } from "./portfolio";

export interface ApiPortfolio {
  slug: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  years_experience: number;
  ats_score: number | null;
  summary: string;
  skills: { name: string; level: number }[];
  ats_history: { version_no: number; ats_score: number | null; created_at: string }[];
  score_breakdown: { label: string; score: number }[];
  recommended_roles: { role: string; company: string; location: string; match: number }[];
  resume_file_name: string;
  updated_at: string;
  is_recruiter?: boolean;
  company?: string | null;
  company_role?: string | null;
  avatar_url?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
}

export interface ApiMyPortfolio {
  slug: string;
  path: string;
}

export function mapPortfolioFromApi(raw: ApiPortfolio): PortfolioProfile {
  return {
    slug: raw.slug,
    name: raw.name,
    email: raw.email,
    headline: raw.headline,
    location: raw.location,
    yearsExperience: raw.years_experience,
    atsScore: raw.ats_score,
    summary: raw.summary,
    skills: raw.skills ?? [],
    atsHistory: (raw.ats_history ?? []).map((p) => ({
      versionNo: p.version_no,
      atsScore: p.ats_score,
      createdAt: p.created_at,
    })),
    scoreBreakdown: raw.score_breakdown ?? [],
    recommendedRoles: raw.recommended_roles ?? [],
    resumeFileName: raw.resume_file_name,
    updatedAt: raw.updated_at,
    isRecruiter: raw.is_recruiter ?? false,
    company: raw.company ?? null,
    companyRole: raw.company_role ?? null,
    avatarUrl: raw.avatar_url ?? null,
    linkedinUrl: raw.linkedin_url ?? null,
    githubUrl: raw.github_url ?? null,
    portfolioUrl: raw.portfolio_url ?? null,
  };
}
