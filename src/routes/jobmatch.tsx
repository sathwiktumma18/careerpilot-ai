import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  ChevronDown,
  CircleAlert,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { useResumeStore, useSelectedResume } from "@/lib/store";
import { jobMatchService } from "@/services/api";
import type { JobMatchResponse, LiveJob } from "@/lib/job-match";

export const Route = createFileRoute("/jobmatch")({
  head: () => ({ meta: [{ title: "JobMatch AI — CareerPilot" }] }),
  component: JobMatchPage,
});

function JobMatchPage() {
  const resumes = useResumeStore((s) => s.resumes);
  const selected = useSelectedResume();
  const selectResume = useResumeStore((s) => s.selectResume);

  const [response, setResponse] = useState<JobMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdScored, setJdScored] = useState(false);

  // Live jobs (Phase C) — real postings from JSearch, India-first, ≤4 weeks old.
  const [liveQuery, setLiveQuery] = useState("");
  const [liveLocation, setLiveLocation] = useState("");
  const [liveJobs, setLiveJobs] = useState<LiveJob[] | null>(null);
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSearched, setLiveSearched] = useState(false);
  const [livePostedWithinDays, setLivePostedWithinDays] = useState(28);

  const analyzed = resumes.filter((r) => r.analysis.atsScore > 0);
  const activeId = selected && selected.analysis.atsScore > 0 ? selected.id : analyzed[0]?.id;

  const runLiveSearch = async (query?: string, location?: string) => {
    const q = (query ?? liveQuery).trim();
    if (!q) return;
    setLiveLoading(true);
    setLiveSearched(true);
    try {
      const res = await jobMatchService.searchLiveJobs({
        query: q,
        location: location ?? liveLocation,
        remoteOnly,
        limit: 10,
      });
      setLiveJobs(res.jobs);
      setLiveAvailable(res.available);
      setLivePostedWithinDays(res.postedWithinDays);
    } catch {
      setLiveJobs([]);
      setLiveAvailable(false);
    } finally {
      setLiveLoading(false);
    }
  };

  const runMatch = async (opts?: { jd?: string }) => {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await jobMatchService.match({
        resumeId: activeId,
        jobDescription: opts?.jd ?? (opts ? jdText : ""),
        remoteOnly,
        limit: 12,
      });
      setResponse(result);
      if (opts?.jd) setJdScored(true);
      // After a match, pull live postings for the resume's headline role so
      // the page shows real, apply-able jobs right away.
      if (!liveQuery.trim()) {
        setLiveQuery(result.resumeTitle);
        void runLiveSearch(result.resumeTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matching failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Auto-match when the active resume changes.
  useEffect(() => {
    if (activeId) void runMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <RoleGate roles={["job_seeker"]} redirectTo="/dashboard">
      <AppShell>
        <PageHeader
          eyebrow="JobMatch AI"
          title="Find roles that fit your resume"
          description={
            activeId
              ? "Ranked by skill overlap plus semantic similarity to each job description."
              : "Upload and analyze a resume first — matching needs its skill profile."
          }
          actions={
            <button
              onClick={() => void runMatch()}
              disabled={loading || !activeId}
              className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Matching…" : "Match my resume"}
            </button>
          }
        />

        {analyzed.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No analyzed resume yet"
            description="Upload a PDF resume and run an analysis — Job Match ranks roles against the skills it detects."
            action={
              <Link
                to="/resume/upload"
                className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
              >
                <Upload className="h-4 w-4" /> Upload resume
              </Link>
            }
          />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Results column */}
            <div className="lg:col-span-2">
              {/* Live jobs — real postings from JSearch with Apply links. */}
              <div className="glass mb-5 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Live jobs from across the web</h3>
                  {liveSearched && liveAvailable && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> posted ≤ {livePostedWithinDays} days
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Real postings from job boards (Naukri, Indeed, Google listings…), India first.
                  Apply straight from here — no login required.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="relative min-w-0 flex-1 basis-52">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      value={liveQuery}
                      onChange={(e) => setLiveQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void runLiveSearch()}
                      placeholder="Job title, e.g. Frontend Engineer"
                      className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="relative min-w-0 basis-40 flex-1">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      value={liveLocation}
                      onChange={(e) => setLiveLocation(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void runLiveSearch()}
                      placeholder="Location, e.g. Bengaluru"
                      className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    onClick={() => void runLiveSearch()}
                    disabled={liveLoading || !liveQuery.trim()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card/60 px-4 text-sm transition hover:border-primary/40 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {liveLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {liveLoading ? "Searching…" : "Search live jobs"}
                  </button>
                </div>

                {liveSearched && liveAvailable === false && (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
                    <span className="font-medium text-amber-500">Live jobs are off right now.</span>{" "}
                    Add a free{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5 text-[11px]">
                      JSEARCH_API_KEY
                    </code>{" "}
                    to{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5 text-[11px]">backend/.env</code>{" "}
                    (RapidAPI, ≈100 req/mo) to browse real postings — showing curated matches below
                    for now.
                  </div>
                )}

                {liveLoading ? (
                  <div className="mt-3">
                    <LoadingState label="Fetching live postings…" />
                  </div>
                ) : liveJobs && liveJobs.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {liveJobs.map((job) => (
                      <LiveJobCard key={job.jobId} job={job} />
                    ))}
                  </div>
                ) : liveSearched && liveAvailable ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No live postings matched — try a different title or location.
                  </p>
                ) : null}
              </div>

              {resumes.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Resume:</span>
                  {resumes.map((r) => {
                    const analyzedNow = r.analysis.atsScore > 0;
                    const active = r.id === activeId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => analyzedNow && selectResume(r.id)}
                        disabled={!analyzedNow}
                        title={analyzedNow ? r.fileName : `${r.fileName} — analyze it first`}
                        className={
                          "rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 " +
                          (active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:text-foreground")
                        }
                      >
                        {r.fileName}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remoteOnly}
                    onChange={(e) => setRemoteOnly(e.target.checked)}
                    className="h-4 w-4 accent-[oklch(0.62 0.22 300)]"
                  />
                  Remote only
                </label>
                {response && (
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-medium " +
                      (response.method === "gemini"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500")
                    }
                    title={
                      response.method === "gemini"
                        ? "Matched with Gemini embeddings"
                        : "No Gemini key — matched with offline TF-IDF"
                    }
                  >
                    {response.method === "gemini" ? "AI embeddings" : "Offline TF-IDF"}
                  </span>
                )}
              </div>

              {error && (
                <div className="mb-4">
                  <ErrorState description={error} onRetry={() => void runMatch()} />
                </div>
              )}

              {loading && !response ? (
                <LoadingState label="Ranking roles against your resume…" />
              ) : !response ? (
                <EmptyState title="Ready when you are" description="Pick a resume and hit Match." />
              ) : (
                <div className="space-y-3">
                  {response.results.length === 0 && (
                    <EmptyState
                      title="No roles match your filters"
                      description="Try turning off 'Remote only' or matching a different resume."
                    />
                  )}
                  {response.results.map((job, i) => (
                    <motion.div
                      key={job.jobId + i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="glass rounded-2xl p-5"
                    >
                      <div className="flex items-start gap-4">
                        <MatchRing score={job.matchScore} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{job.title}</h3>
                            {job.source === "paste" && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Pasted JD
                              </span>
                            )}
                            {job.remote && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-500">
                                <Globe className="h-3 w-3" /> Remote
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              {job.company || "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {job.location || "Unknown location"}
                            </span>
                            {job.salaryMin != null && job.salaryMax != null && (
                              <span className="inline-flex items-center gap-1 text-emerald-500">
                                <Wallet className="h-3 w-3" />
                                {formatSalary(job.salaryMin)}–{formatSalary(job.salaryMax)}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground">{job.summary}</p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {job.matchedSkills.map((s) => (
                              <SkillChip key={s} name={s} tone="matched" />
                            ))}
                            {job.bonusSkills.map((s) => (
                              <SkillChip key={s} name={s} tone="bonus" />
                            ))}
                            {job.missingSkills.map((s) => (
                              <SkillChip key={s} name={s} tone="missing" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Paste-a-JD column */}
            <div className="space-y-4">
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Score a job description</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste any JD and see how your resume stacks up — the result appears at the top.
                </p>
                <textarea
                  value={jdText}
                  onChange={(e) => {
                    setJdText(e.target.value);
                    setJdScored(false);
                  }}
                  rows={8}
                  placeholder={
                    "e.g.\nWe are hiring a Senior Frontend Engineer… React, TypeScript, GraphQL…"
                  }
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-card/50 p-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => void runMatch({ jd: jdText })}
                  disabled={loading || !jdText.trim()}
                  className="mt-3 w-full rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Scoring…" : "Score this JD"}
                </button>
                {jdScored && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-emerald-500">
                    <CircleAlert className="h-3 w-3" /> Scored — see “Pasted JD” at the top.
                  </p>
                )}
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">What the score means</h3>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <MatchDot tone="matched" />
                    Matched — skills the job requires that your resume has.
                  </li>
                  <li className="flex gap-2">
                    <MatchDot tone="bonus" />
                    Bonus — nice-to-haves you already cover.
                  </li>
                  <li className="flex gap-2">
                    <MatchDot tone="missing" />
                    Missing — close these gaps to stand out.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </RoleGate>
  );
}

/* --------------------------------- Helpers --------------------------------- */

function MatchRing({ score }: { score: number }) {
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
    <div className="relative h-16 w-16 shrink-0">
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
  );
}

const TONES: Record<string, string> = {
  matched: "bg-emerald-500/10 text-emerald-500",
  bonus: "bg-sky-500/10 text-sky-500",
  missing: "bg-amber-500/10 text-amber-500",
};

function SkillChip({ name, tone }: { name: string; tone: keyof typeof TONES }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${TONES[tone]}`}>
      {name}
    </span>
  );
}

function MatchDot({ tone }: { tone: keyof typeof TONES }) {
  const bg = { matched: "bg-emerald-500", bonus: "bg-sky-500", missing: "bg-amber-500" }[tone];
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${bg}`} />;
}

function formatSalary(value: number): string {
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
}

/* ------------------------- Live jobs (Phase C) ------------------------- */

function LiveJobCard({ job }: { job: LiveJob }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-3 transition hover:border-primary/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{job.title}</span>
          {job.india && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              India
            </span>
          )}
          {job.remote && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-500">
              <Globe className="h-3 w-3" /> Remote
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{job.company || "—"}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.location || "Unknown location"}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-500">
            <Clock className="h-3 w-3" /> {formatPosted(job.postedAt)}
          </span>
          {job.salaryMin != null && job.salaryMax != null && (
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <Wallet className="h-3 w-3" /> {formatLiveSalary(job)}
            </span>
          )}
        </div>
      </div>
      <a
        href={job.applyLink ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
      >
        Apply <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function formatPosted(iso: string): string {
  const posted = new Date(iso);
  if (Number.isNaN(posted.getTime())) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - posted.getTime()) / 86_400_000));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `Posted ${days} days ago`;
}

function formatLiveSalary(job: LiveJob): string {
  const { salaryMin, salaryMax, salaryPeriod } = job;
  if (salaryMin == null && salaryMax == null) return "";
  const fmt = (v: number) =>
    salaryPeriod === "hourly" ? `$${v.toLocaleString()}/hr` : formatSalary(v);
  if (salaryMin != null && salaryMax != null) return `${fmt(salaryMin)}–${fmt(salaryMax)}`;
  return salaryMin != null ? fmt(salaryMin) : fmt(salaryMax ?? 0);
}
