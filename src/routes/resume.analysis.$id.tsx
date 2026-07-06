import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/resume/analysis/$id")({
  head: () => ({ meta: [{ title: "Analysis — ResumeAI" }] }),
  component: () => <div>hi</div>,
});
