import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FileText, Sparkles, Upload, TrendingUp, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useResumeStore } from "@/lib/store";
import { resumeService } from "@/services/api";

export const Route = createFileRoute("/resume/")({
  head: () => ({ meta: [{ title: "ResumeAI — CareerPilot" }] }),
  component: ResumeHome,
});

function ResumeHome() {
  const resumes = useResumeStore((s) => s.resumes);
  const removeResume = useResumeStore((s) => s.removeResume);

  // Sync from the backend on mount so the list reflects server state (the
  // backend is the source of truth; the store is a cache).
  useEffect(() => {
    resumeService.list().catch((err) => console.warn("Could not sync resumes", err));
  }, []);

  const avg = resumes.length
    ? Math.round(resumes.reduce((a, r) => a + r.analysis.atsScore, 0) / resumes.length)
    : 0;
  const matched = resumes.reduce((a, r) => a + r.analysis.recommendedRoles.length, 0);

  async function handleDelete(id: string, name: string) {
    try {
      await resumeService.remove(id);
      toast.success(`Removed ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove resume");
    }
  }

  return (
    <RoleGate roles={["job_seeker"]} redirectTo="/dashboard">
      <AppShell>
        <PageHeader
          eyebrow="ResumeAI"
          title="Optimize resumes with production-grade AI"
          description="Upload a PDF and receive an ATS score, skill gaps, tailored suggestions, and role matches in under 30 seconds."
          actions={
            <Link
              to="/resume/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
            >
              <Upload className="h-4 w-4" /> Upload resume
            </Link>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Resumes analyzed"
            value={String(resumes.length)}
            delta={resumes.length ? "+1 recent" : "—"}
            trend="up"
            index={0}
          />
          <StatCard
            label="Avg ATS score"
            value={avg ? String(avg) : "—"}
            delta={avg ? (avg >= 75 ? "Strong" : "Growing") : "—"}
            trend="up"
            index={1}
          />
          <StatCard
            label="Roles matched"
            value={String(matched)}
            delta={matched ? `+${Math.min(matched, 12)}` : "—"}
            trend="up"
            index={2}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent uploads</h3>
              <Link to="/resume/upload" className="text-xs text-primary hover:underline">
                New analysis →
              </Link>
            </div>

            {resumes.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={FileText}
                  title="No resumes yet"
                  description="Upload your first PDF to see ATS scoring, skill gaps, and role matches."
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
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {resumes.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-card/40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.analysis.candidate.title} ·{" "}
                        {formatDistanceToNow(new Date(r.uploadedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">ATS</div>
                        <div className="text-sm font-semibold text-primary">
                          {r.analysis.atsScore}
                        </div>
                      </div>
                      <Link
                        to="/resume/analysis/$id"
                        params={{ id: r.id }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-primary/40 hover:text-primary"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(r.id, r.fileName)}
                        className="rounded-lg p-1.5 text-muted-foreground transition hover:text-destructive"
                        aria-label="Delete resume"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold">What you get</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {[
                "ATS-grade compatibility score",
                "Skill graph vs. target roles",
                "Suggestions ranked by impact",
                "Role matches with fit percentage",
                "Keyword trend over time",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </AppShell>
    </RoleGate>
  );
}
