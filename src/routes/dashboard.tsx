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
import { ArrowRight, FileText, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { mockActivity, mockAnalysis, mockDashboardStats } from "@/lib/mockData";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CareerPilot AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        title="Welcome back, Alex"
        description="Your AI career copilot has fresh insights and 3 new role matches this week."
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
        {mockDashboardStats.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">ATS score trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              +20 pts YTD
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockAnalysis.keywordTrend}>
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
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <ul className="mt-4 space-y-3">
            {mockActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.action}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.target}</div>
                </div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">{a.time}</div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          {
            to: "/resume",
            title: "ResumeAI",
            desc: "Analyze and improve your resume with ATS-grade AI feedback.",
          },
          {
            to: "/jobmatch",
            title: "JobMatch AI",
            desc: "Get ranked matches from thousands of open roles.",
          },
          {
            to: "/interview",
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
