/**
 * Interview Prep domain types — the stable camelCase shape the UI consumes.
 * The backend returns snake_case over the wire; `interview-mapper.ts` bridges.
 */

export type Difficulty = "junior" | "mid" | "senior";

export type InterviewQuestion = {
  id: string; // "q1".."qN" within a session
  category: string; // e.g. "Behavioral", "Technical", "System Design"
  text: string;
  evaluationHints: string[];
};

export type InterviewSession = {
  sessionId: string;
  role: string;
  difficulty: Difficulty;
  questions: InterviewQuestion[];
};

export type InterviewFeedback = {
  questionId: string;
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
};
