import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { useResumeStore, useSelectedResume } from "@/lib/store";
import { interviewService } from "@/services/api";
import type { Difficulty, InterviewFeedback, InterviewSession } from "@/lib/interview";

export const Route = createFileRoute("/interview")({
  head: () => ({ meta: [{ title: "Interview AI — CareerPilot" }] }),
  component: InterviewPage,
});

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "junior", label: "Junior", hint: "Concrete, beginner-friendly" },
  { value: "mid", label: "Mid", hint: "Balanced" },
  { value: "senior", label: "Senior", hint: "Trade-offs & scale" },
];

const COUNTS = [3, 5, 8];

function InterviewPage() {
  const resumes = useResumeStore((s) => s.resumes);
  const selected = useSelectedResume();
  const selectResume = useResumeStore((s) => s.selectResume);

  const analyzed = resumes.filter((r) => r.analysis.atsScore > 0);
  const activeId = selected && selected.analysis.atsScore > 0 ? selected.id : analyzed[0]?.id;

  // Session config
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [count, setCount] = useState(5);

  // Live session state
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = session?.questions[index];
  const isLast = session != null && index === session.questions.length - 1;
  const finished = feedback != null && isLast;

  const start = async () => {
    if (!activeId || loading) return;
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const s = await interviewService.start({ resumeId: activeId, role, difficulty, count });
      setSession(s);
      setIndex(0);
      setAnswer("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Starting the session failed — is the backend running?",
      );
    } finally {
      setLoading(false);
    }
  };

  const score = async () => {
    if (!session || !answer.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const f = await interviewService.feedback(
        session.sessionId,
        session.questions[index].id,
        answer,
      );
      setFeedback(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring your answer failed — try again.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    setFeedback(null);
    setAnswer("");
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setSession(null);
    setFeedback(null);
    setAnswer("");
    setError(null);
    setIndex(0);
  };

  return (
    <RoleGate roles={["job_seeker"]} redirectTo="/dashboard">
      <AppShell>
        <PageHeader
          eyebrow="Interview AI"
          title="Practice for the role you want"
          description={
            session
              ? `${session.role} · ${session.difficulty} level — answer out loud or type, then get scored.`
              : "Role-specific questions generated from your resume's skills, with scored feedback."
          }
          actions={
            session && !finished ? (
              <button
                onClick={restart}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> New session
              </button>
            ) : undefined
          }
        />

        {analyzed.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No analyzed resume yet"
            description="Upload a PDF resume and run an analysis — interview questions are generated from the skills it detects."
            action={
              <Link
                to="/resume/upload"
                className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
              >
                <Upload className="h-4 w-4" /> Upload resume
              </Link>
            }
          />
        ) : session === null ? (
          /* --------------------------- Setup panel --------------------------- */
          <div className="mx-auto mt-6 max-w-2xl">
            <div className="glass rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ListChecks className="h-4 w-4 text-primary" /> Session setup
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a resume and target role. Questions adapt to the skills the analysis found.
              </p>

              <label className="mt-5 block text-xs font-medium text-muted-foreground">Resume</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {analyzed.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectResume(r.id)}
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (r.id === activeId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {r.fileName}
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-xs font-medium text-muted-foreground">
                Target role
              </label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Full Stack Engineer"
                className="mt-2 w-full rounded-xl border border-border bg-card/50 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />

              <label className="mt-5 block text-xs font-medium text-muted-foreground">
                Difficulty
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    title={d.hint}
                    className={
                      "rounded-xl border px-3 py-2 text-sm font-medium transition " +
                      (difficulty === d.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-xs font-medium text-muted-foreground">
                Questions
              </label>
              <div className="mt-2 flex gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={
                      "h-10 w-12 rounded-xl border text-sm font-medium transition " +
                      (count === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                onClick={() => void start()}
                disabled={loading || !activeId}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading ? "Generating questions…" : "Start interview"}
              </button>
              {error && (
                <div className="mt-4">
                  <ErrorState description={error} onRetry={() => void start()} />
                </div>
              )}
            </div>
          </div>
        ) : finished ? (
          /* --------------------------- Done summary -------------------------- */
          <div className="mx-auto mt-6 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Session complete 🎉</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.role} · {session.difficulty} · {session.questions.length} questions. Final
                score: <span className="font-semibold text-foreground">{feedback.score}/100</span>.
              </p>
              <button
                onClick={restart}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" /> Start a new session
              </button>
            </motion.div>
          </div>
        ) : (
          /* --------------------------- Active session ------------------------ */
          <div className="mx-auto mt-6 max-w-3xl">
            {/* Progress */}
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Question {index + 1} of {session.questions.length}
              </span>
              <span className="capitalize">{session.difficulty}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-500"
                style={{
                  width: `${((index + (feedback ? 1 : 0)) / session.questions.length) * 100}%`,
                }}
              />
            </div>

            {error && (
              <div className="mt-4">
                <ErrorState
                  description={error}
                  onRetry={() => void (feedback ? next() : score())}
                />
              </div>
            )}

            {question && (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass mt-4 rounded-2xl p-6"
              >
                <span className={CATEGORY_TONE[question.category] ?? CATEGORY_TONE.default}>
                  {question.category}
                </span>
                <h3 className="mt-3 text-lg font-semibold leading-snug">{question.text}</h3>

                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    What a strong answer covers
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {question.evaluationHints.map((hint) => (
                      <li key={hint} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                        {hint}
                      </li>
                    ))}
                  </ul>
                </details>

                {feedback ? (
                  <div className="mt-5 border-t border-border/60 pt-5">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <ScoreRing score={feedback.score} />
                      <div className="min-w-0 flex-1 space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                            Strengths
                          </h4>
                          <ul className="mt-1.5 space-y-1 text-sm text-foreground/90">
                            {feedback.strengths.map((s) => (
                              <li key={s} className="flex gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                            To improve
                          </h4>
                          <ul className="mt-1.5 space-y-1 text-sm text-foreground/90">
                            {feedback.improvements.map((s) => (
                              <li key={s} className="flex gap-2">
                                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {feedback.modelAnswer && (
                          <div className="rounded-xl bg-card/60 p-4">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                              <Lightbulb className="h-3.5 w-3.5" /> Model answer
                            </h4>
                            <p className="mt-1.5 text-sm text-foreground/80">
                              {feedback.modelAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={next}
                        className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
                      >
                        {isLast ? "Finish session" : "Next question"}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={8}
                      placeholder={
                        "Type your answer… Try STAR: Situation, Task, Action, Result. " +
                        "Name trade-offs and back claims with numbers."
                      }
                      className="w-full resize-y rounded-xl border border-border bg-card/50 p-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {answer.trim().length ? `${answer.trim().split(/\s+/).length} words` : " "}
                      </span>
                      <button
                        onClick={() => void score()}
                        disabled={loading || !answer.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {loading ? "Scoring…" : "Score my answer"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </AppShell>
    </RoleGate>
  );
}

/* --------------------------------- Helpers --------------------------------- */

const CATEGORY_TONE: Record<string, string> = {
  Technical: "rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500",
  "System Design": "rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-500",
  Behavioral: "rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-500",
  default: "rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
};

function ScoreRing({ score }: { score: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const tone =
    score >= 75
      ? "oklch(0.7 0.19 155)"
      : score >= 55
        ? "oklch(0.72 0.19 85)"
        : "oklch(0.68 0.03 260)";
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="oklch(1 0 0 / 0.08)"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{score}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</span>
    </div>
  );
}
