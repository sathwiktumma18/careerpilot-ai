import { describe, expect, it } from "vitest";
import {
  mapJobLiteFromApi,
  mapJobMatchFromApi,
  type ApiJobMatchResponse,
} from "./job-match-mapper";

const apiMatch: ApiJobMatchResponse = {
  resume_id: "r-1",
  resume_title: "Senior Full-Stack Engineer",
  detected_skills: ["React", "TypeScript"],
  method: "gemini",
  results: [
    {
      job_id: "paste",
      title: "Your pasted job description",
      company: "",
      location: "",
      remote: false,
      salary_min: null,
      salary_max: null,
      match_score: 87,
      matched_skills: ["React", "TypeScript"],
      missing_skills: ["SQL"],
      bonus_skills: ["GraphQL"],
      summary: "Strong fit on React.",
      source: "paste",
    },
    {
      job_id: "sr-frontend-linear",
      title: "Senior Frontend Engineer",
      company: "Linear",
      location: "Remote (US/EU)",
      remote: true,
      salary_min: 150000,
      salary_max: 210000,
      match_score: 72,
      matched_skills: ["React"],
      missing_skills: ["Tailwind CSS"],
      bonus_skills: [],
      summary: "Good fit.",
      source: "corpus",
    },
  ],
};

describe("mapJobMatchFromApi", () => {
  it("maps snake_case payload onto the camelCase contract", () => {
    const m = mapJobMatchFromApi(apiMatch);
    expect(m.resumeId).toBe("r-1");
    expect(m.resumeTitle).toBe("Senior Full-Stack Engineer");
    expect(m.detectedSkills).toEqual(["React", "TypeScript"]);
    expect(m.method).toBe("gemini");

    const [paste, corpus] = m.results;
    expect(paste.jobId).toBe("paste");
    expect(paste.matchScore).toBe(87);
    expect(paste.salaryMin).toBeNull();
    expect(paste.matchedSkills).toEqual(["React", "TypeScript"]);
    expect(paste.bonusSkills).toEqual(["GraphQL"]);
    expect(paste.source).toBe("paste");

    expect(corpus.company).toBe("Linear");
    expect(corpus.remote).toBe(true);
    expect(corpus.salaryMax).toBe(210000);
    expect(corpus.source).toBe("corpus");
  });

  it("defaults missing collections to empty arrays", () => {
    const partial = mapJobMatchFromApi({
      ...apiMatch,
      detected_skills: undefined as unknown as string[],
      results: undefined as unknown as ApiJobMatchResponse["results"],
    });
    expect(partial.detectedSkills).toEqual([]);
    expect(partial.results).toEqual([]);
  });
});

describe("mapJobLiteFromApi", () => {
  it("maps a browse job", () => {
    const job = mapJobLiteFromApi({
      job_id: "frontend-figma",
      title: "Frontend Engineer",
      company: "Figma",
      location: "London, UK",
      remote: false,
      salary_min: 130000,
      salary_max: 180000,
      category: "Frontend",
      skills_count: 4,
      description: "Build performant React features.",
    });
    expect(job.jobId).toBe("frontend-figma");
    expect(job.category).toBe("Frontend");
    expect(job.skillsCount).toBe(4);
    expect(job.remote).toBe(false);
  });
});
