import { createFileRoute } from "@tanstack/react-router";
import { Bell, Sparkles, Briefcase, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useNotificationStore, type NotificationKind } from "@/lib/store";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CareerPilot" }] }),
  component: NotificationsPage,
});

const iconFor: Record<NotificationKind, typeof Bell> = {
  resume: Sparkles,
  match: Briefcase,
  interview: MessagesSquare,
  system: Bell,
};

function NotificationsPage() {
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clear = useNotificationStore((s) => s.clear);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Stay on top of resume insights, role matches, and interview prep."
        actions={
          <>
            <button
              onClick={() => {
                clear();
                toast.success("Inbox cleared");
              }}
              className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card"
            >
              Clear all
            </button>
            <button
              onClick={() => {
                markAllRead();
                toast.success("All caught up");
              }}
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)]"
            >
              Mark all as read
            </button>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New resume insights, role matches, and interview reminders will land here."
        />
      ) : (
        <div className="glass rounded-2xl">
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = iconFor[n.kind] ?? Bell;
              return (
                <li key={n.id} className="flex items-start gap-4 p-4 transition hover:bg-card/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {n.title}
                      {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{n.detail}</div>
                  </div>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
