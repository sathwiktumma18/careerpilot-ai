/**
 * Recruiter Dashboard — the real candidate pipeline.
 * Backed by `GET /api/recruiter/candidates`: job seekers who have actually
 * analyzed a resume or searched for jobs on the platform, newest-active first.
 * Search + role filter + sort (ATS / activity / newest), shortlist, and a
 * profile drawer with resume summary, skills, searched roles, and a direct
 * message thread to the candidate.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
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
import {
  messagesService,
  recruiterService,
  type ApiCandidateDetail,
  type ApiCandidateSummary,
} from "@/services/api";
import { useRecruiterStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recruiter")({
  head: () => ({ meta: [{ title: "Candidates — CareerPilot AI" }] }),
  component: RecruiterPage,
});

type SortMode = "ats" | "active" | "newest";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "C";

const atsTone = (score: number) =>
  score >= 75
    ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
    : score >= 55
      ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
      : "bg-destructive/10 text-destructive";

const timeAgo = (iso: string | null) => {
  if (!iso) return "No activity yet";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

function RecruiterPage() {
  const navigate = useNavigate();
  const shortlistedIds = useRecruiterStore((s) => s.shortlistedIds);
  const toggleShortlist = useRecruiterStore((s) => s.toggleShortlist);
  const [candidates, setCandidates] = useState<ApiCandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");
  const [active, setActive] = useState<ApiCandidateSummary | null>(null);

  const refresh = () => {
    recruiterService
      .candidates()
      .then(setCandidates)
      .catch(() => toast.error("Could not load candidates"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  // Role filter chips: the most-searched roles across the candidate pool.
  const roleOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      for (const r of c.searched_roles) counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name]) => name);
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = candidates.filter((c) => {
      if (role && !c.searched_roles.includes(role)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.headline.toLowerCase().includes(q) ||
        c.searched_roles.some((r) => r.toLowerCase().includes(q))
      );
    });
    if (sort === "ats") {
      list = [...list].sort((a, b) => (b.ats_score ?? -1) - (a.ats_score ?? -1));
    } else if (sort === "active") {
      list = [...list].sort(
        (a, b) => b.analyzed_count + b.search_count - (a.analyzed_count + a.search_count),
      );
    } else {
      list = [...list].sort((a, b) => (b.last_active ?? "").localeCompare(a.last_active ?? ""));
    }
    return list;
  }, [candidates, query, role, sort]);

  const avgAts = (() => {
    const scored = candidates.filter((c) => c.ats_score != null);
    return scored.length
      ? Math.round(scored.reduce((a, c) => a + (c.ats_score ?? 0), 0) / scored.length)
      : null;
  })();

  return (
    <RoleGate roles={["recruiter"]} redirectTo="/dashboard">
      <AppShell>
        <PageHeader
          eyebrow="Recruiter"
          title="Candidate pipeline"
          description="Real job seekers on CareerPilot who have analyzed a resume or hunted for a role — newest active first."
          actions={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {candidates.length} active seeker
              {candidates.length === 1 ? "" : "s"}
            </span>
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
            value={String(shortlistedIds.length)}
            delta="saved for later"
          />
          <StatCard
            index={3}
            label="Job searches"
            value={String(candidates.reduce((a, c) => a + c.search_count, 0))}
            delta="across candidates"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Loading your candidates…</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Users}
              title="No candidates yet"
              description="When a job seeker analyzes a resume or searches for a role, they appear here with their ATS score, searched roles, and a direct message thread."
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
                      placeholder="Search by name, headline, or searched role…"
                      className="h-10 w-full rounded-lg border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortMode)}
                    className="h-10 rounded-lg border border-input bg-card/60 px-3 text-sm outline-none focus:border-primary"
                    aria-label="Sort candidates"
                  >
                    <option value="newest">Sort: Recently active</option>
                    <option value="ats">Sort: ATS score</option>
                    <option value="active">Sort: Most active</option>
                  </select>
                </div>
                {roleOptions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Searched roles:</span>
                    <button
                      onClick={() => setRole(null)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition",
                        role === null
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      All
                    </button>
                    {roleOptions.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(role === r ? null : r)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition",
                          role === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Grid */}
            <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => {
                const saved = shortlistedIds.includes(c.user_id);
                return (
                  <StaggerItem key={c.user_id}>
                    <div className="group glass relative flex h-full flex-col rounded-2xl p-5 transition hover:-translate-y-1 hover:border-primary/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-[var(--shadow-glow)]">
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{c.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.headline || "Career professional"}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleShortlist(c.user_id)}
                          aria-label={saved ? "Remove from shortlist" : "Shortlist candidate"}
                          className={cn(
                            "shrink-0 rounded-lg p-1.5 transition hover:scale-110",
                            saved ? "text-primary" : "text-muted-foreground hover:text-primary",
                          )}
                        >
                          <Star className={cn("h-5 w-5", saved && "fill-current")} />
                        </button>
                      </div>

                      {(c.location || c.last_active) && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {c.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {c.location}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Activity className="h-3 w-3" /> {timeAgo(c.last_active)}
                          </span>
                        </div>
                      )}

                      {c.searched_roles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {c.searched_roles.slice(0, 3).map((r) => (
                            <span
                              key={r}
                              className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {r}
                            </span>
                          ))}
                          {c.searched_roles.length > 3 && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              +{c.searched_roles.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between pt-4">
                        {c.ats_score != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                              atsTone(c.ats_score),
                            )}
                          >
                            <Sparkles className="h-3 w-3" /> ATS {c.ats_score}
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
                  description="Try a different search or clear the role filter."
                />
              </div>
            )}
          </>
        )}

        {/* Profile drawer */}
        <Sheet open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
            {active && <CandidateProfile candidate={active} onMessage={refresh} />}
          </SheetContent>
        </Sheet>
      </AppShell>
    </RoleGate>
  );
}

function CandidateProfile({
  candidate,
  onMessage,
}: {
  candidate: ApiCandidateSummary;
  onMessage: () => void;
}) {
  const navigate = useNavigate();
  const saved = useRecruiterStore((s) => s.shortlistedIds.includes(candidate.user_id));
  const toggle = useRecruiterStore((s) => s.toggleShortlist);
  const [detail, setDetail] = useState<ApiCandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    recruiterService
      .candidate(candidate.user_id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidate.user_id]);

  async function messageCandidate() {
    setOpening(true);
    try {
      const thread = await messagesService.open(candidate.user_id);
      onMessage();
      navigate({ to: "/messages/$id", params: { id: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start a conversation");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3 pr-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-[var(--shadow-glow)]">
            {initials(candidate.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate">{candidate.name}</div>
            <div className="text-xs font-normal text-muted-foreground">
              {candidate.headline || "Career professional"}
            </div>
          </div>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
          {candidate.location && (
            <span className="inline-flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" /> {candidate.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs">
            <Activity className="h-3 w-3" /> Active {timeAgo(candidate.last_active)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs">
            <Briefcase className="h-3 w-3" /> {candidate.search_count} search
            {candidate.search_count === 1 ? "" : "es"}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {candidate.ats_score != null && (
          <span
            className={cn("rounded-full px-3 py-1 text-sm font-bold", atsTone(candidate.ats_score))}
          >
            ATS {candidate.ats_score}/100
          </span>
        )}
        <button
          onClick={() => toggle(candidate.user_id)}
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

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {detail?.summary && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Summary
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {detail.summary}
              </p>
            </div>
          )}

          {detail && detail.skills.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top skills
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.skills.slice(0, 12).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail && detail.searched_roles.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Roles they&apos;re hunting
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.searched_roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <button
              onClick={messageCandidate}
              disabled={opening}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-60"
            >
              {opening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              {detail?.conversation_id ? "Open conversation" : "Message candidate"}
            </button>
            {detail?.resume_id && (
              <button
                onClick={() =>
                  navigate({ to: "/resume/analysis/$id", params: { id: detail.resume_id! } })
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
              >
                <ArrowUpRight className="h-4 w-4" /> Open full analysis
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
