/**
 * Recruiter Dashboard — your uploaded resumes rendered as a candidate pool.
 * Each resume is a candidate: search, filter by skill, sort, shortlist, and
 * open a full profile drawer. Built entirely from real resume data (no backend
 * changes); the shortlist persists in localStorage.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Briefcase,
  Eye,
  FileText,
  History,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  Upload,
  Users,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { FadeIn, Stagger, StaggerItem } from "@/components/common/Motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useResumeStore, useRecruiterStore, type ResumeRecord } from "@/lib/store";
import type { RadarPoint, RoleMatch, Suggestion } from "@/lib/analysis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recruiter")({
  head: () => ({ meta: [{ title: "Recruiter Dashboard — CareerPilot AI" }] }),
  component: RecruiterPage,
});

type Candidate = {
  resume: ResumeRecord;
  name: string;
  headline: string;
  location: string;
  email: string;
  ats: number | null;
  skills: { name: string; level: number }[];
  summary: string;
  scoreBreakdown: { label: string; score: number }[];
  suggestions: Suggestion[];
  skillsRadar: RadarPoint[];
  recommendedRoles: RoleMatch[];
  versionCount: number;
  viewCount: number;
  uploadedAt: string;
};

type SortMode = "ats" | "views" | "newest";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "C";

const stripExt = (name: string) => name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");

function toCandidate(r: ResumeRecord): Candidate {
  const a = r.analysis;
  const analyzed = a.atsScore > 0;
  const name =
    a.candidate.name && a.candidate.name !== "Candidate" ? a.candidate.name : stripExt(r.fileName);
  return {
    resume: r,
    name,
    headline: a.candidate.title || "Career professional",
    location: a.candidate.location,
    email: a.candidate.email,
    ats: analyzed ? a.atsScore : null,
    skills: a.detectedSkills,
    summary: a.summary,
    scoreBreakdown: a.scoreBreakdown,
    suggestions: a.suggestions,
    skillsRadar: a.skillsRadar,
    recommendedRoles: a.recommendedRoles,
    versionCount: r.versionCount,
    viewCount: r.viewCount,
    uploadedAt: r.uploadedAt,
  };
}

const atsTone = (score: number) =>
  score >= 75
    ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
    : score >= 55
      ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
      : "bg-destructive/10 text-destructive";

function RecruiterPage() {
  const resumes = useResumeStore((s) => s.resumes);
  const shortlistedIds = useRecruiterStore((s) => s.shortlistedIds);
  const toggleShortlist = useRecruiterStore((s) => s.toggleShortlist);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("ats");
  const [active, setActive] = useState<Candidate | null>(null);

  const candidates = useMemo(() => resumes.map(toCandidate), [resumes]);

  // Skill filter chips: the most common detected skills across the pool.
  const skillOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      for (const s of c.skills) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([name]) => name);
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = candidates.filter((c) => {
      if (skill && !c.skills.some((s) => s.name === skill)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.headline.toLowerCase().includes(q) ||
        c.skills.some((s) => s.name.toLowerCase().includes(q))
      );
    });
    if (sort === "ats") {
      list = [...list].sort((a, b) => (b.ats ?? -1) - (a.ats ?? -1));
    } else if (sort === "views") {
      list = [...list].sort((a, b) => b.viewCount - a.viewCount);
    } else {
      list = [...list].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    }
    return list;
  }, [candidates, query, skill, sort]);

  const avgAts = (() => {
    const scored = candidates.filter((c) => c.ats != null);
    return scored.length
      ? Math.round(scored.reduce((a, c) => a + (c.ats ?? 0), 0) / scored.length)
      : null;
  })();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Recruiter"
        title="Candidate pool"
        description="Your uploaded resumes, reviewed like applicants. Shortlist the strong ones and open full profiles."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Candidate pool — built from your uploaded resumes
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Candidates"
          value={String(candidates.length)}
          delta="in your pool"
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
          value={String(shortlistedIds.length)}
          delta="saved for later"
        />
        <StatCard
          index={3}
          label="Total Views"
          value={String(candidates.reduce((a, c) => a + c.viewCount, 0))}
          delta="resume views"
        />
      </div>

      {candidates.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={FileText}
            title="No candidates yet"
            description="Upload and analyze a resume to see it appear here as a candidate profile."
            action={
              <Link
                to="/resume/upload"
                className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
              >
                <Upload className="h-4 w-4" /> Upload a resume
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Controls */}
          <FadeIn className="mt-6">
            <div className="glass rounded-2xl p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, headline, or skill…"
                    className="h-10 w-full rounded-lg border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="h-10 rounded-lg border border-input bg-card/60 px-3 text-sm outline-none focus:border-primary"
                  aria-label="Sort candidates"
                >
                  <option value="ats">Sort: ATS score</option>
                  <option value="views">Sort: Most viewed</option>
                  <option value="newest">Sort: Newest</option>
                </select>
              </div>
              {skillOptions.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Skills:</span>
                  <button
                    onClick={() => setSkill(null)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      skill === null
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All
                  </button>
                  {skillOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSkill(skill === s ? null : s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition",
                        skill === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Grid */}
          <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const saved = shortlistedIds.includes(c.resume.id);
              return (
                <StaggerItem key={c.resume.id}>
                  <div className="group glass relative flex h-full flex-col rounded-2xl p-5 transition hover:-translate-y-1 hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-[var(--shadow-glow)]">
                          {initials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.headline}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleShortlist(c.resume.id)}
                        aria-label={saved ? "Remove from shortlist" : "Shortlist candidate"}
                        className={cn(
                          "shrink-0 rounded-lg p-1.5 transition hover:scale-110",
                          saved ? "text-primary" : "text-muted-foreground hover:text-primary",
                        )}
                      >
                        <Star className={cn("h-5 w-5", saved && "fill-current")} />
                      </button>
                    </div>

                    {(c.location || c.viewCount > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {c.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {c.viewCount} views
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <History className="h-3 w-3" /> v{c.versionCount}
                        </span>
                      </div>
                    )}

                    {c.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.skills.slice(0, 4).map((s) => (
                          <span
                            key={s.name}
                            className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {s.name}
                          </span>
                        ))}
                        {c.skills.length > 4 && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            +{c.skills.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4">
                      {c.ats != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                            atsTone(c.ats),
                          )}
                        >
                          <Sparkles className="h-3 w-3" /> ATS {c.ats}
                        </span>
                      ) : (
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                          Not analyzed
                        </span>
                      )}
                      <button
                        onClick={() => setActive(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/50 px-2.5 py-1.5 text-xs font-medium transition group-hover:border-primary/40 group-hover:text-primary"
                      >
                        View profile <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>

          {filtered.length === 0 && (
            <div className="mt-6">
              <EmptyState
                icon={Search}
                title="No matching candidates"
                description="Try a different search or clear the skill filter."
              />
            </div>
          )}
        </>
      )}

      {/* Profile drawer */}
      <Sheet open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
          {active && <CandidateProfile candidate={active} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function CandidateProfile({ candidate: c }: { candidate: Candidate }) {
  const saved = useRecruiterStore((s) => s.shortlistedIds.includes(c.resume.id));
  const toggle = useRecruiterStore((s) => s.toggleShortlist);

  return (
    <div>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3 pr-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-[var(--shadow-glow)]">
            {initials(c.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate">{c.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{c.headline}</div>
          </div>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
          {c.location && (
            <span className="inline-flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" /> {c.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs">
            <Eye className="h-3 w-3" /> {c.viewCount} views
          </span>
          <span className="inline-flex items-center gap-1 text-xs">
            <History className="h-3 w-3" /> {c.versionCount} version{c.versionCount > 1 ? "s" : ""}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {c.ats != null && (
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", atsTone(c.ats))}>
            ATS {c.ats}/100
          </span>
        )}
        <button
          onClick={() => toggle(c.resume.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
            saved
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card/50 text-muted-foreground hover:text-primary",
          )}
        >
          <Star className={cn("h-4 w-4", saved && "fill-current")} />
          {saved ? "Shortlisted" : "Shortlist"}
        </button>
      </div>

      {c.summary && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.summary}</p>
        </div>
      )}

      {c.skillsRadar.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Skill balance
          </div>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={c.skillsRadar}>
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
      )}

      {c.scoreBreakdown.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Score breakdown
          </div>
          <div className="mt-3 space-y-3">
            {c.scoreBreakdown.map((b) => (
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
      )}

      {c.suggestions.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Suggested improvements
          </div>
          <ul className="mt-3 space-y-2">
            {c.suggestions.slice(0, 4).map((s) => (
              <li key={s.title} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{s.title}</div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.recommendedRoles.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended roles
          </div>
          <div className="mt-3 space-y-2">
            {c.recommendedRoles.slice(0, 3).map((r) => (
              <div
                key={`${r.role}-${r.company}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.role}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.company}
                    {r.location ? ` · ${r.location}` : ""}
                  </div>
                </div>
                <span className="ml-3 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {r.match}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/resume/analysis/$id"
        params={{ id: c.resume.id }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
      >
        <Briefcase className="h-4 w-4" /> Open full analysis
      </Link>

      {!c.resume.versions.length && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Analysis may still be running.
        </p>
      )}
    </div>
  );
}
