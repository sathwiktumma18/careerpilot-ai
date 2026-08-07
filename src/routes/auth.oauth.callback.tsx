import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { authService } from "@/services/api";

const searchSchema = z.object({
  token: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/auth/oauth/callback")({
  head: () => ({ meta: [{ title: "Completing sign-in — CareerPilot AI" }] }),
  validateSearch: searchSchema,
  component: OAuthCallbackPage,
});

const errorMessage: Record<string, { text: string; toLogin: boolean }> = {
  email_taken: {
    text: "An account already exists for that email. Sign in with your email instead.",
    toLogin: true,
  },
  access_denied: { text: "You cancelled the sign-in — no problem.", toLogin: true },
  invalid_state: {
    text: "This sign-in link expired or was invalid. Please try again.",
    toLogin: true,
  },
  provider: { text: "The provider couldn't complete the sign-in. Try again.", toLogin: true },
};

function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { token, error } = Route.useSearch();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    (async () => {
      // An error from the provider (or an invalid state) — bounce back to login.
      if (error) {
        const known = errorMessage[error] ?? errorMessage.invalid_state;
        setMessage(known.text);
        setStatus("error");
        toast.error(known.text);
        return;
      }
      if (!token) {
        setMessage(errorMessage.invalid_state.text);
        setStatus("error");
        toast.error(errorMessage.invalid_state.text);
        return;
      }
      try {
        await authService.completeOAuth(token);
        toast.success("Signed in with your social account");
        navigate({ to: "/dashboard" });
      } catch (e) {
        const text =
          e instanceof Error && e.message.includes("already")
            ? errorMessage.email_taken.text
            : "Could not complete social sign-in. Try again.";
        setMessage(text);
        setStatus("error");
        toast.error(text);
      }
    })();
  }, [token, error, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative z-10 w-full max-w-md rounded-3xl p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>

        {status === "working" ? (
          <>
            <h1 className="text-lg font-semibold">Completing sign-in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Linking your account and preparing your workspace.
            </p>
            <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-primary" />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Sign-in didn't complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Link
              to="/auth/login"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
            >
              Back to sign in
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
