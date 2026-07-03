import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, Mic, Brain, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/interview")({
  head: () => ({ meta: [{ title: "InterviewAI — Coming soon" }] }),
  component: () => (
    <AppShell>
      <ComingSoon
        module="InterviewAI"
        icon={MessagesSquare}
        description="Realistic AI mock interviews with voice, adaptive difficulty, and post-session scoring."
        features={[
          { title: "Voice interviews", detail: "Low-latency spoken sessions with follow-up probing.", icon: Mic },
          { title: "Adaptive AI", detail: "Behavioral, system design, and role-specific tracks.", icon: Brain },
          { title: "Scored feedback", detail: "Structured signals, transcripts, and improvement plan.", icon: BarChart3 },
        ]}
      />
    </AppShell>
  ),
});
