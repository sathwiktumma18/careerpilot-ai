import { describe, expect, it } from "vitest";
import { mapAnalysisFromApi, type ApiAnalysis } from "./analysis-mapper";

const apiAnalysis: ApiAnalysis = {
  id: "r-1",
  file_name: "jane_doe.pdf",
  uploaded_at: "2026-08-04T06:00:00+00:00",
  ats_score: 84,
  candidate: {
    name: "Jane Doe",
    title: "Senior Full-Stack Engineer",
    location: "Bengaluru, IN",
    email: "jane.doe@gmail.com",
    years_experience: 9,
  },
  summary: "A summary",
  score_breakdown: [
    { label: "Formatting", score: 90 },
    { label: "Keywords", score: 80 },
  ],
  detected_skills: [{ name: "React", level: 95 }],
  missing_skills: [{ name: "Kubernetes", importance: "High", reason: "Common in senior roles." }],
  suggestions: [{ title: "Quantify", detail: "Add metrics.", severity: "high" }],
  recommended_roles: [
    { role: "Platform Engineer", company: "Stripe", location: "Dublin", match: 88 },
  ],
  keyword_trend: [{ month: "Jan", score: 60 }],
  skills_radar: [{ area: "Backend", value: 70 }],
};

describe("mapAnalysisFromApi", () => {
  it("maps snake_case payload onto the camelCase Analysis contract", () => {
    const a = mapAnalysisFromApi(apiAnalysis);
    expect(a.id).toBe("r-1");
    expect(a.fileName).toBe("jane_doe.pdf");
    expect(a.uploadedAt).toBe(apiAnalysis.uploaded_at);
    expect(a.atsScore).toBe(84);
    expect(a.candidate).toEqual({
      name: "Jane Doe",
      title: "Senior Full-Stack Engineer",
      location: "Bengaluru, IN",
      email: "jane.doe@gmail.com",
      yearsExperience: 9,
    });
    expect(a.scoreBreakdown).toEqual(apiAnalysis.score_breakdown);
    expect(a.detectedSkills).toEqual(apiAnalysis.detected_skills);
    expect(a.missingSkills).toEqual(apiAnalysis.missing_skills);
    expect(a.suggestions).toEqual(apiAnalysis.suggestions);
    expect(a.recommendedRoles).toEqual(apiAnalysis.recommended_roles);
    expect(a.keywordTrend).toEqual(apiAnalysis.keyword_trend);
    expect(a.skillsRadar).toEqual(apiAnalysis.skills_radar);
  });

  it("defaults missing collections to empty arrays", () => {
    const partial = mapAnalysisFromApi({
      ...apiAnalysis,
      score_breakdown: undefined as unknown as ApiAnalysis["score_breakdown"],
      detected_skills: undefined as unknown as ApiAnalysis["detected_skills"],
    });
    expect(partial.scoreBreakdown).toEqual([]);
    expect(partial.detectedSkills).toEqual([]);
    // Fields that were NOT nulled keep their mapped values.
    expect(partial.missingSkills).toEqual(apiAnalysis.missing_skills);
    expect(partial.suggestions).toEqual(apiAnalysis.suggestions);
  });
});
