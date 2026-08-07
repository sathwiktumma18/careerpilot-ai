import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  Share2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Briefcase,
  History,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Gauge } from "@/components/common/Gauge";
import { useResumeStore } from "@/lib/store";
import { type Analysis } from "@/lib/analysis";
import { exportAnalysisReport } from "@/lib/report-export";
import { resumeService } from "@/services/api";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/resume/analysis/$id")({
  head: () => ({ meta: [{ title: "Analysis — ResumeAI" }] }),
  component: AnalysisPage,
});

const severityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium:
    "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20",
  low: "bg-primary/10 text-primary border-primary/20",
} as const;

function AnalysisPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const record = useResumeStore((s) => s.resumes.find((r) => r.id === id));
  const selectResume = useResumeStore((s) => s.selectResume);
  const selectedId = useResumeStore((s) => s.selectedId);
  // Version picker: null = the current version; otherwise the fetched analysis
  // of the chosen historical version.
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [versionAnalysis, setVersionAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    if (!record) return;
    if (selectedId !== record.id) selectResume(record.id);
  }, [record, selectResume, selectedId]);

  // Always pull fresh detail (versions + view count) when the page mounts —
  // covers cold-store reloads and keeps the picker in sync after new uploads.
  useEffect(() => {
    resumeService.get(id).catch(() => toast.error("Could not load this analysis"));
  }, [id]);

  async function handleVersionChange(versionNo: number) {
    // The current version is the highest one — no fetch needed.
    if (record && versionNo === record.versionCount) {
      setViewingVersion(null);
      setVersionAnalysis(null);
      return;
    }
    try {
      const a = await resumeService.getVersionAnalysis(id, versionNo);
      setViewingVersion(versionNo);
      setVersionAnalysis(a);
    } catch {
      toast.error("Could not load that version");
    }
  }

  if (!record) {
    return (
      <AppShell>
        <PageHeader eyebrow="ResumeAI" title="Analysis not found" />
        <EmptyState
          icon={FileText}
          title="This resume no longer exists"
          description="It may have been deleted, or the link is invalid."
          action={
            <Link
              to="/resume"
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
            >
              Back to ResumeAI
            </Link>
          }
        />
      </AppShell>
    );
  }

  // The version being viewed: the current one, or a fetched historical one.
  const a = viewingVersion && versionAnalysis ? versionAnalysis : record.analysis;
  async function handleExport() {
    try {
      await exportAnalysisReport(a);
      toast.success("Report downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the report");
    }
  }
  function handleShare() {
    toast.success("Share link copied");
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow={record.fileName}
        title={`Analysis for ${a.candidate.name}`}
        description={`${a.candidate.title} · ${a.candidate.location} · ${a.candidate.yearsExperience} years experience`}
        actions={
          <>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-card"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-card"
            >
              <Download className="h-4 w-4" /> Export report
            </button>
            <button
              onClick={() => navigate({ to: "/resume/upload", search: { resumeId: id } })}
              className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
            >
              <Upload className="h-4 w-4" /> Upload new version
            </button>
          </>
        }
      />

      {/* Version picker — switch between snapshots of this resume. */}
      {record.versions.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Version
          </span>
          <select
            value={viewingVersion ?? record.versionCount}
            onChange={(e) => handleVersionChange(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus:border-primary"
            aria-label="Select resume version"
          >
            {record.versions.map((v) => (
              <option key={v.versionNo} value={v.versionNo}>
                v{v.versionNo} · {v.fileName}
                {v.atsScore != null
                  ? ` · ATS ${v.atsScore}`
                  : v.status === "uploaded"
                    ? " · not analyzed"
                    : ""}
              </option>
            ))}
          </select>
          {viewingVersion != null && (
            <button
              onClick={() => handleVersionChange(record.versionCount)}
              className="text-xs text-primary hover:underline"
            >
              Back to current version
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ATS Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass relative overflow-hidden rounded-2xl p-6"
        >
          <div className="absolute inset-0 bg-[image:var(--gradient-glow)]" />
          <div className="relative">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ATS score
            </div>
            <div className="mt-2 flex justify-center">
              <Gauge score={a.atsScore} size={148} sublabel="overall fit" />
            </div>
            <div className="mt-4 space-y-2">
              {a.scoreBreakdown.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-medium">{b.score}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                      style={{ width: `${b.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI summary
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.summary}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Skill balance
              </div>
              <div className="h-52">
                <ResponsiveContainer>
                  <RadarChart data={a.skillsRadar}>
                    <PolarGrid stroke="oklch(1 0 0 / 0.08)" />
                    <PolarAngleAxis
                      dataKey="area"
                      tick={{ fontSize: 10, fill: "oklch(0.68 0.03 260)" }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="oklch(0.65 0.19 258)"
                      fill="oklch(0.65 0.19 258)"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top detected skills
              </div>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={a.detectedSkills.slice(0, 6)} layout="vertical">
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" horizontal={false} />
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="oklch(0.68 0.03 260)"
                      fontSize={11}
                      width={80}
                    />
                    <Tooltip
                      cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                      contentStyle={{
                        background: "oklch(0.2 0.025 265)",
                        border: "1px solid oklch(1 0 0 / 0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="level" fill="oklch(0.65 0.19 258)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> Skills detected
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {a.detectedSkills.map((s) => (
              <span
                key={s.name}
                className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs"
              >
                {s.name}
                <span className="ml-1.5 text-muted-foreground">{s.level}</span>
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" /> Missing skills
          </div>
          <ul className="mt-4 space-y-3">
            {a.missingSkills.map((s) => (
              <li key={s.name} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                  {s.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {s.name}
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {s.importance}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" /> Improvement suggestions
          </div>
          <ul className="mt-4 space-y-3">
            {a.suggestions.map((s) => (
              <li
                key={s.title}
                className={cn(
                  "rounded-xl border p-4",
                  severityStyles[s.severity as keyof typeof severityStyles],
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                    {s.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm opacity-90">{s.detail}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-primary" /> Recommended roles
          </div>
          <ul className="mt-4 space-y-3">
            {a.recommendedRoles.map((r) => (
              <li
                key={r.role}
                className="rounded-xl border border-border bg-card/40 p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.role}</div>
                  <div className="text-xs font-semibold text-primary">{r.match}%</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.company} · {r.location}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                    style={{ width: `${r.match}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/jobmatch"
            className="mt-4 block rounded-lg border border-border py-2 text-center text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            Explore JobMatch AI →
          </Link>
        </motion.div>
      </div>
    </AppShell>
  );
}
