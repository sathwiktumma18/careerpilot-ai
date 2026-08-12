import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  FileText,
  MessageSquare,
  Palette,
  Sparkles,
  Upload,
  UserRoundSearch,
  Users,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import {
  useAuthStore,
  useResumeStore,
  useSelectedResume,
  useNotificationStore,
  useRecruiterStore,
  type User,
} from "@/lib/store";
import { messagesService, recruiterService, type ApiCandidateSummary } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CareerPilot AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const role = useAuthStore((s) => s.user?.role ?? "job_seeker");
  const user = useAuthStore((s) => s.user);
  const resumes = useResumeStore((s) => s.resumes);
  const selectResume = useResumeStore((s) => s.selectResume);
  const selectedId = useResumeStore((s) => s.selectedId);
  const selected = useSelectedResume();
  const activity = useNotificationStore((s) => s.items).slice(0, 6);

  // Recruiters get a candidate-centric dashboard — job-seeker resume stats make
  // no sense for them.
  if (role === "recruiter") {
    return <RecruiterDashboard user={user} />;
  }

  const stats = (() => {
    const avg = resumes.length
      ? Math.round(resumes.reduce((a, r) => a + r.analysis.atsScore, 0) / resumes.length)
      : 0;
    const versions = resumes.reduce((a, r) => a + r.versionCount, 0);
    const views = resumes.reduce((a, r) => a + r.viewCount, 0);
    return [
      {
        label: "Resumes Analyzed",
        value: String(resumes.length),
        delta: resumes.length ? "+1 recent" : "—",
        trend: "up" as const,
      },
      {
        label: "Avg ATS Score",
        value: avg ? String(avg) : "—",
        delta: avg ? (avg >= 75 ? "Strong" : "Growing") : "—",
        trend: "up" as const,
      },
      {
        label: "Versions Created",
        value: String(versions),
        delta: versions ? `${versions} snapshot${versions > 1 ? "s" : ""}` : "—",
        trend: "up" as const,
      },
      {
        label: "Total Views",
        value: String(views),
        delta: views ? "across all resumes" : "—",
        trend: "up" as const,
      },
    ];
  })();

  // Per-resume ATS journey: v1 score → latest score, with a delta badge.
  // A resume is "analyzed" once its current version has a real analysis —
  // emptyAnalysis is all zeros, so never show a misleading delta from it.
  const atsTrendRows = resumes.map((r) => {
    const first = r.firstAts;
    const currentVersion = r.versions[r.versions.length - 1];
    const analyzed = currentVersion
      ? currentVersion.status === "analyzed"
      : r.analysis.atsScore > 0;
    const latest = analyzed ? r.analysis.atsScore : null;
    const delta = first != null && latest != null ? latest - first : null;
    return { resume: r, first, latest, delta };
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={
          selected
            ? `Viewing insights for ${selected.fileName}. Switch resumes below to compare.`
            : "Upload your first resume to unlock personalized ATS insights and role matches."
        }
        actions={
          <Link
            to="/resume/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Analyze new resume
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>

      {resumes.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Resume:</span>
          {resumes.map((r) => {
            const active = (selectedId ?? resumes[0]?.id) === r.id;
            return (
              <button
                key={r.id}
                onClick={() => selectResume(r.id)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
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

      {atsTrendRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mt-6 overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between px-6 pt-6">
            <div>
              <h3 className="text-sm font-semibold">Resume ATS journey</h3>
              <p className="text-xs text-muted-foreground">
                How each resume improved from its first version to the current one
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {atsTrendRows.filter((r) => r.first != null && r.latest != null).length} tracked
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-2 font-medium">Resume</th>
                  <th className="px-4 py-2 font-medium">First ATS</th>
                  <th className="px-4 py-2 font-medium">Current ATS</th>
                  <th className="px-4 py-2 font-medium">Delta</th>
                  <th className="px-6 py-2 font-medium">Views</th>
                </tr>
              </thead>
              <tbody>
                {atsTrendRows.map((row) => {
                  const d = row.delta;
                  const up = d != null && d > 0;
                  const down = d != null && d < 0;
                  return (
                    <tr
                      key={row.resume.id}
                      className="border-b border-border/50 transition last:border-0 hover:bg-card/40"
                    >
                      <td className="px-6 py-3">
                        <Link
                          to="/resume/analysis/$id"
                          params={{ id: row.resume.id }}
                          className="font-medium hover:text-primary"
                        >
                          {row.resume.fileName}
                        </Link>
                        <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {row.resume.versionCount}{" "}
                          {row.resume.versionCount > 1 ? "versions" : "version"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.first ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold">{row.latest ?? "—"}</td>
                      <td className="px-4 py-3">
                        {d == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium " +
                              (down
                                ? "bg-destructive/10 text-destructive"
                                : up
                                  ? "bg-primary/10 text-primary"
                                  : "bg-card text-muted-foreground")
                            }
                          >
                            {up ? "↑" : down ? "↓" : ""} {d > 0 ? "+" : ""}
                            {d}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{row.resume.viewCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">ATS score trend</h3>
              <p className="text-xs text-muted-foreground">
                {selected ? selected.fileName : "Upload a resume to see your trend"}
              </p>
            </div>
            {selected && (
              <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Current {selected.analysis.atsScore}
              </div>
            )}
          </div>
          <div className="mt-4 h-64">
            {selected ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selected.analysis.keywordTrend}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.19 258)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.62 0.22 300)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="oklch(0.68 0.03 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.68 0.03 260)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.2 0.025 265)",
                      border: "1px solid oklch(1 0 0 / 0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="oklch(0.65 0.19 258)"
                    strokeWidth={2}
                    fill="url(#grad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={FileText}
                  title="No data yet"
                  description="Upload a resume to see how your ATS score is trending."
                  action={
                    <Link
                      to="/resume/upload"
                      className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
                    >
                      <Upload className="h-4 w-4" /> Upload resume
                    </Link>
                  }
                />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold">Recent activity</h3>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          {
            to: "/resume" as const,
            title: "ResumeAI",
            desc: "Analyze and improve your resume with ATS-grade AI feedback.",
          },
          {
            to: "/jobmatch" as const,
            title: "JobMatch AI",
            desc: "Get ranked matches from thousands of open roles.",
          },
          {
            to: "/interview" as const,
            title: "InterviewAI",
            desc: "Practice with realistic AI-driven mock interviews.",
          },
        ].map((c, i) => (
          <motion.div
            key={c.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Link
              to={c.to}
              className="group block h-full rounded-2xl border border-border bg-card/40 p-5 transition hover:border-primary/40 hover:bg-card/70"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{c.title}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Recruiter dashboard — candidate stats instead of resume stats              */
/* -------------------------------------------------------------------------- */

function RecruiterDashboard({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const shortlisted = useRecruiterStore((s) => s.shortlistedIds.length);
  const [candidates, setCandidates] = useState<ApiCandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recruiterService
      .candidates()
      .then(setCandidates)
      .catch(() => toast.error("Could not load candidates"))
      .finally(() => setLoading(false));
  }, []);

  const avgAts = (() => {
    const scored = candidates.filter((c) => c.ats_score != null);
    return scored.length
      ? Math.round(scored.reduce((a, c) => a + (c.ats_score ?? 0), 0) / scored.length)
      : null;
  })();

  const totalSearches = candidates.reduce((a, c) => a + c.search_count, 0);

  async function messageCandidate(candidateId: string) {
    try {
      const thread = await messagesService.open(candidateId);
      navigate({ to: "/messages/$id", params: { id: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start a conversation");
    }
  }

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "C";

  const top = [...candidates].sort((a, b) => (b.ats_score ?? -1) - (a.ats_score ?? -1)).slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Your candidate pipeline at a glance — who's active, who's strong, and who you should message."
        actions={
          <Link
            to="/recruiter"
            className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
          >
            <UserRoundSearch className="h-4 w-4" /> Open candidate pipeline
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Active candidates"
          value={String(candidates.length)}
          delta="on the platform"
        />
        <StatCard
          index={1}
          label="Avg ATS"
          value={avgAts ? String(avgAts) : "—"}
          delta={avgAts ? "pool average" : "no analyses yet"}
        />
        <StatCard
          index={2}
          label="Shortlisted"
          value={String(shortlisted)}
          delta="saved for later"
        />
        <StatCard
          index={3}
          label="Job searches"
          value={String(totalSearches)}
          delta="across candidates"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Top candidates by ATS</h3>
              <p className="text-xs text-muted-foreground">
                The strongest active seekers on your list
              </p>
            </div>
            <Link
              to="/recruiter"
              className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="flex h-56 items-center justify-center text-muted-foreground">
              <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            </div>
          ) : top.length === 0 ? (
            <div className="flex h-56 items-center justify-center">
              <EmptyState
                icon={Users}
                title="No candidates yet"
                description="When job seekers analyze resumes or search roles, they'll appear here."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
              {top.map((c, i) => (
                <div
                  key={c.user_id}
                  className="flex items-center gap-3 border-b border-border/40 px-4 py-3 transition last:border-0 hover:bg-card/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-xs font-bold text-white">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.headline || "Career professional"}
                      {c.ats_score != null ? ` · ATS ${c.ats_score}` : ""}
                    </div>
                  </div>
                  {c.ats_score != null && (
                    <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary sm:inline">
                      ATS {c.ats_score}
                    </span>
                  )}
                  <button
                    onClick={() => void messageCandidate(c.user_id)}
                    aria-label={`Message ${c.name}`}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold">Recruiter shortcuts</h3>
          <div className="mt-4 space-y-2">
            {[
              {
                to: "/recruiter" as const,
                title: "Candidate pipeline",
                desc: "Search, filter, and shortlist active seekers.",
                icon: Users,
              },
              {
                to: "/messages" as const,
                title: "Inbox",
                desc: "Reply to job seekers who've reached out.",
                icon: MessageSquare,
              },
              {
                to: "/portfolio" as const,
                title: "My portfolio",
                desc: "Your public recruiter profile page.",
                icon: Palette,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card/40 p-3 transition hover:border-primary/40 hover:bg-card/70"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {s.title}
                      {s.title === "Candidate pipeline" && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                          {candidates.length}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
