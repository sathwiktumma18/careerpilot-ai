import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, FileText, Sparkles, Upload, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuthStore, useResumeStore, useSelectedResume, useNotificationStore } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CareerPilot AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const resumes = useResumeStore((s) => s.resumes);
  const selectResume = useResumeStore((s) => s.selectResume);
  const selectedId = useResumeStore((s) => s.selectedId);
  const selected = useSelectedResume();
  const activity = useNotificationStore((s) => s.items).slice(0, 6);

  const stats = (() => {
    const avg = resumes.length
      ? Math.round(resumes.reduce((a, r) => a + r.analysis.atsScore, 0) / resumes.length)
      : 0;
    const matched = resumes.reduce((a, r) => a + r.analysis.recommendedRoles.length, 0);
    return [
      { label: "Resumes Analyzed", value: String(resumes.length), delta: resumes.length ? "+1 recent" : "—", trend: "up" as const },
      { label: "Avg ATS Score", value: avg ? String(avg) : "—", delta: avg ? (avg >= 75 ? "Strong" : "Growing") : "—", trend: "up" as const },
      { label: "Matched Roles", value: String(matched), delta: matched ? `+${Math.min(matched, 12)}` : "—", trend: "up" as const },
      { label: "Interviews Ready", value: String(Math.max(0, Math.floor(avg / 10))), delta: avg ? "+2" : "—", trend: "up" as const },
    ];
  })();

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
          { to: "/resume" as const, title: "ResumeAI", desc: "Analyze and improve your resume with ATS-grade AI feedback." },
          { to: "/jobmatch" as const, title: "JobMatch AI", desc: "Get ranked matches from thousands of open roles." },
          { to: "/interview" as const, title: "InterviewAI", desc: "Practice with realistic AI-driven mock interviews." },
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
