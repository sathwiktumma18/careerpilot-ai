import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Target, Zap, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/jobmatch")({
  head: () => ({ meta: [{ title: "JobMatch AI — Coming soon" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        module="JobMatch AI"
        icon={Briefcase}
        description="Rank thousands of open roles by fit, salary, and career trajectory using your resume graph."
        features={[
          {
            title: "Fit scoring",
            detail: "Personalized match % across skills, seniority, and comp.",
            icon: Target,
          },
          {
            title: "Real-time feeds",
            detail: "Continuous ingestion from top job boards and ATS partners.",
            icon: Zap,
          },
          {
            title: "Smart filters",
            detail: "Location, remote, salary, and stage — save preferred queries.",
            icon: Filter,
          },
        ]}
      />
    </AppShell>
  ),
});
