import { createFileRoute } from "@tanstack/react-router";
import { Users, Search, Filter, Inbox } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/recruiter")({
  head: () => ({ meta: [{ title: "Recruiter Dashboard — Coming soon" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        module="Recruiter Dashboard"
        icon={Users}
        description="Source and shortlist candidates from the CareerPilot talent graph with AI-ranked pipelines."
        features={[
          {
            title: "AI sourcing",
            detail: "Natural-language search across candidate embeddings.",
            icon: Search,
          },
          {
            title: "Pipelines",
            detail: "Kanban stages, notes, and collaborative review.",
            icon: Inbox,
          },
          {
            title: "Advanced filters",
            detail: "Skills, seniority, comp, location, availability.",
            icon: Filter,
          },
        ]}
      />
    </AppShell>
  ),
});
