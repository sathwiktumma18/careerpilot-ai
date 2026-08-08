import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessagesSquare,
  Map,
  Palette,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAuthStore, type UserRole } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Job seekers see the full AI suite. */
const seekerNav = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "AI Modules",
    items: [
      { to: "/resume", label: "ResumeAI", icon: FileText },
      { to: "/jobmatch", label: "JobMatch AI", icon: Briefcase },
      { to: "/interview", label: "InterviewAI", icon: MessagesSquare },
      { to: "/roadmap", label: "Career Roadmap", icon: Map },
      { to: "/portfolio", label: "PortfolioAI", icon: Palette, badge: "Live" },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

/** Recruiters don't analyze resumes/interviews — they get a candidate dashboard,
 * their own portfolio, and messaging. (Messaging + candidates arrive with the
 * inbox feature; the dashboard becomes role-aware in the recruiter phase.) */
const recruiterNav = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "AI Modules",
    items: [{ to: "/portfolio", label: "PortfolioAI", icon: Palette, badge: "Live" }],
  },
  {
    label: "Account",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

function buildNav(role: UserRole): typeof seekerNav {
  return role === "recruiter" ? recruiterNav : seekerNav;
}

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role ?? "job_seeker");
  const navGroups = buildNav(role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">CareerPilot</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            AI Suite
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-[image:var(--gradient-primary)]"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {"badge" in item && item.badge && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-xl p-4 glass">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {role === "recruiter" ? "Recruiter plan" : "Pro plan"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {role === "recruiter"
            ? "Candidate analytics, messaging, and your public recruiter profile."
            : "Unlimited analyses, priority AI models, and recruiter insights."}
        </p>
        <button className="mt-3 w-full rounded-md bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90">
          Manage plan
        </button>
      </div>
    </aside>
  );
}
