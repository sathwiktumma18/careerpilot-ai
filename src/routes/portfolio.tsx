import { createFileRoute } from "@tanstack/react-router";
import { Palette, Wand2, Globe, LayoutTemplate } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "PortfolioAI — Coming soon" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        module="PortfolioAI"
        icon={Palette}
        description="Turn your resume and projects into a polished portfolio site in one click."
        features={[
          {
            title: "AI templates",
            detail: "Design directions matched to your role and vibe.",
            icon: LayoutTemplate,
          },
          {
            title: "One-click generate",
            detail: "Full site content from your resume and repos.",
            icon: Wand2,
          },
          {
            title: "Custom domain",
            detail: "Publish to a your-name.dev URL in seconds.",
            icon: Globe,
          },
        ]}
      />
    </AppShell>
  ),
});
