/**
 * Career Roadmap domain types — the stable camelCase shape the UI consumes.
 * The backend returns snake_case over the wire; `roadmap-mapper.ts` bridges.
 */

export type RoadmapMilestone = {
  week: number;
  title: string;
  focus: string; // what to work on that week
  skills: string[];
  deliverable: string; // concrete portfolio output
};

export type RoadmapPhase = {
  title: string;
  description: string;
  weekStart: number;
  weekEnd: number;
  milestones: RoadmapMilestone[];
};

export type RoadmapPlan = {
  targetRole: string;
  horizon: number;
  summary: string;
  targetSkills: string[];
  phases: RoadmapPhase[];
  generatedBy: "gemini" | "template";
  /** The user's original input when a typo was corrected (≠ targetRole). */
  typedRole?: string | null;
};
