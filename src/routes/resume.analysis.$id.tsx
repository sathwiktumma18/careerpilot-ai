import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/resume/analysis/$id")({
  head: () => ({ meta: [{ title: "Analysis — ResumeAI" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  return (
    <AppShell>
      <PageHeader eyebrow="ResumeAI" title={"ID " + id} />
    </AppShell>
  );
}
