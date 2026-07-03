import { createFileRoute } from "@tanstack/react-router";
import { Map, Compass, Milestone, BookOpen } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/roadmap")({
  head: () => ({ meta: [{ title: "Career Roadmap — Coming soon" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        module="Career Roadmap AI"
        icon={Map}
        description="A personalized 12-month plan to reach your next role, with milestones, courses, and check-ins."
        features={[
          { title: "Path planner", detail: "Goal-driven roadmap generated from your current profile.", icon: Compass },
          { title: "Milestones", detail: "Weekly and monthly checkpoints with adaptive re-planning.", icon: Milestone },
          { title: "Curated resources", detail: "Courses, books, and projects matched to each stage.", icon: BookOpen },
        ]}
      />
    </AppShell>
  ),
});
