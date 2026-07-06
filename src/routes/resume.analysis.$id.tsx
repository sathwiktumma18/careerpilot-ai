import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { useResumeStore } from "@/lib/store";
import { useEffect } from "react";

export const Route = createFileRoute("/resume/analysis/$id")({
  head: () => ({ meta: [{ title: "Analysis — ResumeAI" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const record = useResumeStore((s) => s.resumes.find((r) => r.id === id));
  const selectResume = useResumeStore((s) => s.selectResume);

  useEffect(() => {
    if (id) selectResume(id);
  }, [id, selectResume]);

  return (
    <AppShell>
      <PageHeader eyebrow="ResumeAI" title={record?.fileName ?? "Not found"} />
      <div>ATS: {record?.analysis.atsScore}</div>
    </AppShell>
  );
}
