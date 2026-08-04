/**
 * Maps the backend's snake_cased interview payload onto the camelCase domain
 * shapes in `interview.ts`. Mirrors `job-match-mapper.ts`.
 */
import type {
  Difficulty,
  InterviewFeedback,
  InterviewQuestion,
  InterviewSession,
} from "./interview";

export interface ApiInterviewQuestion {
  id: string;
  category: string;
  text: string;
  evaluation_hints: string[];
}

export interface ApiInterviewSession {
  session_id: string;
  role: string;
  difficulty: Difficulty;
  questions: ApiInterviewQuestion[];
}

export interface ApiInterviewFeedback {
  question_id: string;
  score: number;
  strengths: string[];
  improvements: string[];
  model_answer: string;
}

export function mapInterviewSessionFromApi(raw: ApiInterviewSession): InterviewSession {
  return {
    sessionId: raw.session_id,
    role: raw.role,
    difficulty: raw.difficulty,
    questions: (raw.questions ?? []).map(mapInterviewQuestionFromApi),
  };
}

export function mapInterviewQuestionFromApi(raw: ApiInterviewQuestion): InterviewQuestion {
  return {
    id: raw.id,
    category: raw.category,
    text: raw.text,
    evaluationHints: raw.evaluation_hints ?? [],
  };
}

export function mapInterviewFeedbackFromApi(raw: ApiInterviewFeedback): InterviewFeedback {
  return {
    questionId: raw.question_id,
    score: raw.score,
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
    modelAnswer: raw.model_answer ?? "",
  };
}
