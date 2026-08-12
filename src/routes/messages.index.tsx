/**
 * Inbox — every conversation the current user is part of, newest first.
 * Both roles land here (seekers talk to recruiters, recruiters to seekers);
 * unread counts come from the backend's per-recipient read tracking.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Inbox as InboxIcon, Loader2, Mail, MessageSquare, Search, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { FadeIn, Stagger, StaggerItem } from "@/components/common/Motion";
import { messagesService, type ApiConversationLite } from "@/services/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Inbox — CareerPilot AI" }] }),
  component: InboxPage,
});

const roleLabel = (role: string) => (role === "recruiter" ? "Recruiter" : "Job seeker");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";

function InboxPage() {
  const role = useAuthStore((s) => s.user?.role ?? "job_seeker");
  const [conversations, setConversations] = useState<ApiConversationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const refresh = () => {
    messagesService
      .list()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // Lightweight live polling — new messages appear without a manual refresh.
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const totalUnread = conversations.reduce((a, c) => a + c.unread_count, 0);

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.other_name.toLowerCase().includes(q) ||
      c.preview.toLowerCase().includes(q) ||
      roleLabel(c.other_role).toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title="Messages"
        description={
          totalUnread > 0
            ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""} across your threads.`
            : "Threads with recruiters and job seekers, all in one place."
        }
        actions={
          role === "job_seeker" ? (
            <Link
              to="/recruiters"
              className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
            >
              <Users className="h-4 w-4" /> Find recruiters
            </Link>
          ) : undefined
        }
      />

      <FadeIn className="mt-6">
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </FadeIn>

      {loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">Loading your inbox…</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={InboxIcon}
            title="No conversations yet"
            description={
              role === "job_seeker"
                ? "Find a recruiter and say hello — every message lands in this inbox."
                : "When a job seeker reaches out, their message lands here."
            }
            action={
              role === "job_seeker" ? (
                <Link
                  to="/recruiters"
                  className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
                >
                  <Users className="h-4 w-4" /> Browse recruiters
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Search}
            title="No matching threads"
            description="Try a different search."
          />
        </div>
      ) : (
        <Stagger className="mt-2 grid gap-3 lg:grid-cols-2">
          {filtered.map((c) => (
            <StaggerItem key={c.id}>
              <Link
                to="/messages/$id"
                params={{ id: c.id }}
                className="group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card/70"
              >
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white",
                      c.other_role === "recruiter"
                        ? "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"
                        : "bg-[color:var(--success)]/80",
                    )}
                  >
                    {initials(c.other_name)}
                  </div>
                  {c.unread_count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{c.other_name}</div>
                    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{roleLabel(c.other_role)}</div>
                  <div
                    className={cn(
                      "mt-1 truncate text-sm",
                      c.unread_count > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.unread_count > 0 && <span className="mr-1 text-primary">You:</span>}
                    {c.preview}
                  </div>
                </div>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:text-primary" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </AppShell>
  );
}
