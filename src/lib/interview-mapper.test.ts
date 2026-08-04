import { describe, expect, it } from "vitest";
import {
  mapInterviewFeedbackFromApi,
  mapInterviewSessionFromApi,
  type ApiInterviewFeedback,
  type ApiInterviewSession,
} from "./interview-mapper";

const apiSession: ApiInterviewSession = {
  session_id: "sess-1",
  role: "Full Stack Engineer",
  difficulty: "mid",
  questions: [
    {
      id: "q1",
      category: "Technical",
      text: "How do you optimize a React grid?",
      evaluation_hints: ["virtualization", "memoization", "bundle"],
    },
    {
      id: "q2",
      category: "Behavioral",
      text: "Tell me about a shipped feature.",
      evaluation_hints: ["result", "metric"],
    },
  ],
};

describe("mapInterviewSessionFromApi", () => {
  it("maps snake_case payload onto the camelCase contract", () => {
    const s = mapInterviewSessionFromApi(apiSession);
    expect(s.sessionId).toBe("sess-1");
    expect(s.role).toBe("Full Stack Engineer");
    expect(s.difficulty).toBe("mid");
    expect(s.questions).toHaveLength(2);
    const [q1, q2] = s.questions;
    expect(q1.id).toBe("q1");
    expect(q1.category).toBe("Technical");
    expect(q1.text).toBe("How do you optimize a React grid?");
    expect(q1.evaluationHints).toEqual(["virtualization", "memoization", "bundle"]);
    expect(q2.category).toBe("Behavioral");
  });

  it("defaults missing questions and hints to empty arrays", () => {
    const partial = mapInterviewSessionFromApi({
      ...apiSession,
      questions: undefined as unknown as ApiInterviewSession["questions"],
    });
    expect(partial.questions).toEqual([]);

    const noHints = mapInterviewSessionFromApi({
      ...apiSession,
      questions: [
        { ...apiSession.questions[0], evaluation_hints: undefined as unknown as string[] },
      ],
    });
    expect(noHints.questions[0].evaluationHints).toEqual([]);
  });
});

describe("mapInterviewFeedbackFromApi", () => {
  const apiFeedback: ApiInterviewFeedback = {
    question_id: "q1",
    score: 88,
    strengths: ["Covers trade-offs"],
    improvements: ["Add a metric"],
    model_answer: "A strong answer would…",
  };

  it("maps snake_case payload onto the camelCase contract", () => {
    const f = mapInterviewFeedbackFromApi(apiFeedback);
    expect(f.questionId).toBe("q1");
    expect(f.score).toBe(88);
    expect(f.strengths).toEqual(["Covers trade-offs"]);
    expect(f.improvements).toEqual(["Add a metric"]);
    expect(f.modelAnswer).toBe("A strong answer would…");
  });

  it("defaults missing collections and model_answer", () => {
    const f = mapInterviewFeedbackFromApi({
      question_id: "q2",
      score: 0,
      strengths: undefined as unknown as string[],
      improvements: undefined as unknown as string[],
      model_answer: undefined as unknown as string,
    });
    expect(f.strengths).toEqual([]);
    expect(f.improvements).toEqual([]);
    expect(f.modelAnswer).toBe("");
  });
});
