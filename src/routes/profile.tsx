import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — CareerPilot" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Account" title="Profile" description="Your public CareerPilot identity." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 text-center">
          <Avatar className="mx-auto h-24 w-24">
            <AvatarFallback className="bg-[image:var(--gradient-primary)] text-2xl text-white">
              AM
            </AvatarFallback>
          </Avatar>
          <div className="mt-4 text-lg font-semibold">Alex Morgan</div>
          <div className="text-sm text-muted-foreground">Senior Full-Stack Engineer</div>
          <div className="mt-4 flex justify-center gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-1">Berlin, DE</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
              Pro plan
            </span>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">About</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Full-stack engineer with 6 years shipping consumer and B2B SaaS. Building the future
            of career tooling with CareerPilot.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Email", "alex.morgan@example.com"],
              ["Location", "Berlin, Germany"],
              ["Role", "Senior Full-Stack Engineer"],
              ["Experience", "6 years"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="text-sm">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
