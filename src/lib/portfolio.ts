/**
 * The public portfolio domain shape — mirrors backend/app/schemas/portfolio.py.
 * Consumed by the public `/p/{slug}` page and the in-app `/portfolio` manager.
 * The backend returns it snake_cased over the wire; `portfolio-mapper.ts`
 * bridges the two.
 */
import type { ScoreBreakdown } from "./analysis";

export type PortfolioSkill = { name: string; level: number };
export type PortfolioAtsPoint = {
  versionNo: number;
  atsScore: number | null;
  createdAt: string;
};
export type PortfolioRole = {
  role: string;
  company: string;
  location: string;
  match: number;
};

export type PortfolioProfile = {
  slug: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  yearsExperience: number;
  atsScore: number | null;
  summary: string;
  skills: PortfolioSkill[];
  atsHistory: PortfolioAtsPoint[];
  scoreBreakdown: ScoreBreakdown[];
  recommendedRoles: PortfolioRole[];
  resumeFileName: string;
  updatedAt: string;
  /** Phase F — editable profile identity (both roles). */
  isRecruiter?: boolean;
  company?: string | null;
  companyRole?: string | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
};
