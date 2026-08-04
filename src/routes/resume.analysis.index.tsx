import { createFileRoute, redirect } from "@tanstack/react-router";
import { useResumeStore } from "@/lib/store";
import { resumeService } from "@/services/api";

/**
 * Legacy `/resume/analysis` entry point (no id). Redirects to the newest
 * resume's detail page, or back to the ResumeAI home when empty.
 *
 * IMPORTANT: this MUST be an index route (`resume.analysis.index.tsx`), not
 * `resume.analysis.tsx`. If it lived at `resume.analysis.tsx`, TanStack
 * Router would treat `resume.analysis.$id` as its child and re-run this
 * beforeLoad on every /resume/analysis/<id> navigation, creating an
 * infinite redirect loop that freezes the browser.
 */
export const Route = createFileRoute("/resume/analysis/")({
  beforeLoad: async () => {
    // Hydrate from the backend before deciding where to redirect, so a direct
    // visit to /resume/analysis works even on a cold store (fresh reload).
    if (useResumeStore.getState().resumes.length === 0) {
      try {
        await resumeService.list();
      } catch {
        /* fall through to the empty-state redirect */
      }
    }
    const resumes = useResumeStore.getState().resumes;
    if (resumes.length > 0) {
      throw redirect({
        to: "/resume/analysis/$id",
        params: { id: resumes[0].id },
      });
    }
    throw redirect({ to: "/resume" });
  },
});
