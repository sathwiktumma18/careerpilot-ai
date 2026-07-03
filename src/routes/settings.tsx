import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — CareerPilot" }] }),
  component: SettingsPage,
});

const tabs = ["General", "AI Preferences", "Billing", "Team", "API Keys"] as const;

function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("General");
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your workspace, AI preferences, and billing."
      />

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition",
              t === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Workspace</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Workspace name" defaultValue="Alex Morgan" />
            <Field label="Subdomain" defaultValue="alex.careerpilot.ai" />
            <Field label="Support email" defaultValue="alex@example.com" />
            <Field label="Time zone" defaultValue="Europe / Berlin" />
          </div>
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">AI model</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the reasoning model for resume and interview analysis.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {["Standard", "Pro", "Ultra"].map((m, i) => (
                <button
                  key={m}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    i === 1
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="text-sm font-medium">{m}</div>
                  <div className="text-xs text-muted-foreground">
                    {i === 0
                      ? "Fast, cost-effective"
                      : i === 1
                        ? "Balanced quality & speed"
                        : "Deepest reasoning"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold">Danger zone</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting your workspace is permanent.
          </p>
          <button className="mt-4 w-full rounded-lg border border-destructive/40 bg-destructive/10 py-2 text-sm text-destructive transition hover:bg-destructive/20">
            Delete workspace
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <input
        defaultValue={defaultValue}
        className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
