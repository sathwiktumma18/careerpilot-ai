/**
 * Maps the backend's snake_cased roadmap payload onto the camelCase domain
 * shapes in `roadmap.ts`. Mirrors `interview-mapper.ts`.
 */
import type { RoadmapMilestone, RoadmapPhase, RoadmapPlan } from "./roadmap";

export interface ApiRoadmapMilestone {
  week: number;
  title: string;
  focus: string;
  skills: string[];
  deliverable: string;
}

export interface ApiRoadmapPhase {
  title: string;
  description: string;
  week_start: number;
  week_end: number;
  milestones: ApiRoadmapMilestone[];
}

export interface ApiRoadmapPlan {
  target_role: string;
  horizon: number;
  summary: string;
  target_skills: string[];
  phases: ApiRoadmapPhase[];
  generated_by: "gemini" | "template";
  typed_role?: string | null;
}

export function mapRoadmapFromApi(raw: ApiRoadmapPlan): RoadmapPlan {
  return {
    targetRole: raw.target_role,
    horizon: raw.horizon,
    summary: raw.summary ?? "",
    targetSkills: raw.target_skills ?? [],
    phases: (raw.phases ?? []).map(mapRoadmapPhaseFromApi),
    generatedBy: raw.generated_by,
    typedRole: raw.typed_role ?? null,
  };
}

export function mapRoadmapPhaseFromApi(raw: ApiRoadmapPhase): RoadmapPhase {
  return {
    title: raw.title,
    description: raw.description ?? "",
    weekStart: raw.week_start,
    weekEnd: raw.week_end,
    milestones: (raw.milestones ?? []).map(mapRoadmapMilestoneFromApi),
  };
}

export function mapRoadmapMilestoneFromApi(raw: ApiRoadmapMilestone): RoadmapMilestone {
  return {
    week: raw.week,
    title: raw.title,
    focus: raw.focus ?? "",
    skills: raw.skills ?? [],
    deliverable: raw.deliverable ?? "",
  };
}
