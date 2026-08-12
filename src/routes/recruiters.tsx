/**
 * Recruiters — the job-seeker's directory of recruiters on the platform.
 * Each card opens a conversation with that recruiter (get-or-create on the
 * backend) and jumps straight into the thread.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { FadeIn, Stagger, StaggerItem } from "@/components/common/Motion";
import { messagesService, recruiterService, type ApiRecruiterLite } from "@/services/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recruiters")({
  head: () => ({ meta: [{ title: "Recruiters — CareerPilot AI" }] }),
  component: RecruitersPage,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "R";

function RecruitersPage() {
  const navigate = useNavigate();
  const [recruiters, setRecruiters] = useState<ApiRecruiterLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [messagingId, setMessagingId] = useState<string | null>(null);

  useEffect(() => {
    recruiterService
      .listRecruiters()
      .then(setRecruiters)
      .catch(() => toast.error("Could not load recruiters"))
      .finally(() => setLoading(false));
  }, []);

  async function message(recruiterId: string) {
    setMessagingId(recruiterId);
    try {
      const thread = await messagesService.open(recruiterId);
      navigate({ to: "/messages/$id", params: { id: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start a conversation");
    } finally {
      setMessagingId(null);
    }
  }

  const filtered = recruiters.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  return (
    <RoleGate roles={["job_seeker"]} redirectTo="/dashboard">
      <AppShell>
        <PageHeader
          eyebrow="Network"
          title="Recruiters"
          description="Recruiters on CareerPilot who are actively sourcing candidates. Message any of them to discuss roles."
        />

        <FadeIn className="mt-6">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </FadeIn>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Finding recruiters…</p>
          </div>
        ) : recruiters.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Users}
              title="No recruiters yet"
              description="Recruiters who join CareerPilot will appear here so you can reach out."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Search}
              title="No matching recruiters"
              description="Try a different search."
            />
          </div>
        ) : (
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <StaggerItem key={r.user_id}>
                <div className="group glass flex h-full flex-col rounded-2xl p-5 transition hover:-translate-y-1 hover:border-primary/40">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-[var(--shadow-glow)]">
                      {initials(r.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.headline || "Recruiter · CareerPilot"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{r.email}</span>
                  </div>
                  <button
                    onClick={() => void message(r.user_id)}
                    disabled={messagingId === r.user_id}
                    className={cn(
                      "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-50",
                    )}
                  >
                    {messagingId === r.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    {messagingId === r.user_id ? "Opening…" : "Message"}
                  </button>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </AppShell>
    </RoleGate>
  );
}
