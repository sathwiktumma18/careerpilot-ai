import { describe, expect, it } from "vitest";
import { mapRoadmapFromApi, type ApiRoadmapPhase, type ApiRoadmapPlan } from "./roadmap-mapper";

const apiPlan: ApiRoadmapPlan = {
  target_role: "Full Stack Engineer",
  horizon: 12,
  summary: "A 12-week plan.",
  target_skills: ["Docker", "Kubernetes"],
  generated_by: "gemini",
  phases: [
    {
      title: "Foundation",
      description: "Core skills.",
      week_start: 1,
      week_end: 4,
      milestones: [
        {
          week: 1,
          title: "Learn Docker",
          focus: "Build the mental model.",
          skills: ["Docker"],
          deliverable: "A small exercise.",
        },
      ],
    },
  ],
};

describe("mapRoadmapFromApi", () => {
  it("maps snake_case payload onto the camelCase contract", () => {
    const p = mapRoadmapFromApi(apiPlan);
    expect(p.targetRole).toBe("Full Stack Engineer");
    expect(p.horizon).toBe(12);
    expect(p.summary).toBe("A 12-week plan.");
    expect(p.targetSkills).toEqual(["Docker", "Kubernetes"]);
    expect(p.generatedBy).toBe("gemini");
    expect(p.phases).toHaveLength(1);
    const [phase] = p.phases;
    expect(phase.title).toBe("Foundation");
    expect(phase.weekStart).toBe(1);
    expect(phase.weekEnd).toBe(4);
    const [m] = phase.milestones;
    expect(m.week).toBe(1);
    expect(m.title).toBe("Learn Docker");
    expect(m.focus).toBe("Build the mental model.");
    expect(m.skills).toEqual(["Docker"]);
    expect(m.deliverable).toBe("A small exercise.");
  });

  it("defaults missing collections and summary", () => {
    const partial = mapRoadmapFromApi({
      ...apiPlan,
      summary: undefined as unknown as string,
      target_skills: undefined as unknown as string[],
      phases: undefined as unknown as ApiRoadmapPhase[],
    });
    expect(partial.summary).toBe("");
    expect(partial.targetSkills).toEqual([]);
    expect(partial.phases).toEqual([]);
  });
});
