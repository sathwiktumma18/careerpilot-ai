import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FileText, Sparkles, Upload, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";

export const Route = createFileRoute("/resume/")({
  head: () => ({ meta: [{ title: "ResumeAI — CareerPilot" }] }),
  component: ResumeHome,
});

const recentResumes = [
  { name: "Alex_Morgan_Resume.pdf", score: 82, date: "Today", role: "Senior Full-Stack" },
  { name: "Alex_v3_frontend.pdf", score: 76, date: "2 days ago", role: "Frontend Lead" },
  { name: "Alex_platform.pdf", score: 71, date: "1 week ago", role: "Platform Engineer" },
];

function ResumeHome() {
  return (
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
        <StatCard label="Resumes analyzed" value="24" delta="+12%" trend="up" index={0} />
        <StatCard label="Avg ATS score" value="78" delta="+4 pts" trend="up" index={1} />
        <StatCard label="Roles matched" value="142" delta="+31" trend="up" index={2} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent analyses</h3>
            <Link to="/resume/upload" className="text-xs text-primary hover:underline">
              New analysis →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {recentResumes.map((r) => (
              <li key={r.name} className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.role} · {r.date}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">ATS</div>
                    <div className="text-sm font-semibold text-primary">{r.score}</div>
                  </div>
                  <Link
                    to="/resume/analysis"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-primary/40 hover:text-primary"
                  >
                    View
                  </Link>
                </div>
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
  );
}
