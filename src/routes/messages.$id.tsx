/**
 * Thread — a single conversation between a job seeker and a recruiter.
 * Fetches the backend thread (which auto-marks the other side's messages read),
 * polls for new messages, and sends via the composer.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/EmptyState";
import { messagesService, type ApiConversationDetail, type ApiMessage } from "@/services/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversation — CareerPilot AI" }] }),
  component: ThreadPage,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

function ThreadPage() {
  const { id } = Route.useParams();
  const user = useAuthStore((s) => s.user);
  const [thread, setThread] = useState<ApiConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const otherName = useMemo(() => {
    if (!thread || !user) return "…";
    return thread.seeker_id === user.id ? thread.recruiter_name : thread.seeker_name;
  }, [thread, user]);

  const load = () => {
    messagesService
      .get(id)
      .then(setThread)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this conversation"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending || !thread) return;
    setSending(true);
    try {
      const sent = await messagesService.send(thread.id, body);
      setThread((t) => (t ? { ...t, messages: [...t.messages, sent] } : t));
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title={otherName}
        description="A private thread between a job seeker and a recruiter."
        actions={
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to inbox
          </Link>
        }
      />

      <div className="mx-auto mt-6 flex h-[calc(100vh-260px)] min-h-[420px] max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/30">
        {error ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <ErrorState
              description={error}
              onRetry={() => {
                setError(null);
                load();
              }}
            />
          </div>
        ) : loading && !thread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Loading conversation…</p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {thread && thread.messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No messages yet — say hello to break the ice.
                  </p>
                </div>
              )}
              {thread?.messages.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const prev = thread.messages[i - 1];
                const showDate =
                  !prev ||
                  new Date(m.created_at).toDateString() !==
                    new Date(prev.created_at).toDateString();
                return (
                  <div key={m.id}>
                    {showDate && (
                      <div className="py-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground/70">
                        {new Date(m.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year:
                            new Date(m.created_at).getFullYear() !== new Date().getFullYear()
                              ? "numeric"
                              : undefined,
                        })}
                      </div>
                    )}
                    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          mine
                            ? "rounded-br-md bg-[image:var(--gradient-primary)] text-white"
                            : "rounded-bl-md border border-border/60 bg-card/70 text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                        <div
                          className={cn(
                            "mt-1 text-right text-[10px]",
                            mine ? "text-white/70" : "text-muted-foreground",
                          )}
                        >
                          {timeLabel(m.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 border-t border-border/60 p-3"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={2}
                placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
                className="max-h-40 flex-1 resize-none rounded-xl border border-input bg-card/60 px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
