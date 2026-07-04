import { createFileRoute, redirect } from "@tanstack/react-router";
import { useResumeStore } from "@/lib/store";

/**
 * Legacy `/resume/analysis` entry point. Redirects to the newest resume's
 * detail page, or back to the ResumeAI home when the workspace is empty.
 */
export const Route = createFileRoute("/resume/analysis")({
  beforeLoad: () => {
    const resumes = useResumeStore.getState().resumes;
    if (resumes.length > 0) {
      throw redirect({ to: "/resume/analysis/$id", params: { id: resumes[0].id } });
    }
    throw redirect({ to: "/resume" });
  },
});
