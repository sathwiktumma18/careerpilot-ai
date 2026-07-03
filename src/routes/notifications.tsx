import { createFileRoute } from "@tanstack/react-router";
import { Bell, Sparkles, Briefcase, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CareerPilot" }] }),
  component: NotificationsPage,
});

const items = [
  { icon: Sparkles, title: "Your resume analysis is ready", detail: "Alex_Morgan_Resume.pdf · ATS 82", time: "2m ago", unread: true },
  { icon: Briefcase, title: "3 new role matches", detail: "Linear, Vercel, Stripe — 87%+ fit", time: "1h ago", unread: true },
  { icon: MessagesSquare, title: "Mock interview scheduled", detail: "System Design · Tomorrow 14:00", time: "Yesterday", unread: false },
  { icon: Bell, title: "Weekly digest available", detail: "Trends, matches, and skill signals", time: "2d ago", unread: false },
];

function NotificationsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Stay on top of resume insights, role matches, and interview prep."
        actions={
          <button className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card">
            Mark all as read
          </button>
        }
      />

      <div className="glass rounded-2xl">
        <ul className="divide-y divide-border">
          {items.map((n, i) => {
            const Icon = n.icon;
            return (
              <li key={i} className="flex items-start gap-4 p-4 transition hover:bg-card/40">
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
                <div className="whitespace-nowrap text-xs text-muted-foreground">{n.time}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
