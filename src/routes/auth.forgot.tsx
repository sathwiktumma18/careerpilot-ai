import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { authService } from "@/services/api";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "Forgot password — CareerPilot AI" }] }),
  component: ForgotPage,
});

const emailSchema = z.object({ email: z.string().email("Enter a valid email") });

const resetSchema = z
  .object({
    newPassword: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

/** Demo reset flow: the token is returned in the API response, not emailed. */
function ForgotPage() {
  const [stage, setStage] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    const value = await authService.forgotPassword(values.email);
    setEmail(values.email);
    setToken(value);
    setSent(true);
    // A null token means the email isn't registered — the page still answers
    // generically so visitors can't tell valid accounts apart.
    setStage(value ? "reset" : "done");
  }

  async function onResetSubmit(values: z.infer<typeof resetSchema>) {
    if (!token) return;
    await authService.resetPassword(email, token, values.newPassword);
    toast.success("Password updated — sign in with your new password");
    setStage("done");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative z-10 w-full max-w-md rounded-3xl p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">CareerPilot AI</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Password recovery
            </div>
          </div>
        </div>

        {stage === "email" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the email on your account and we'll generate a one-time reset token.
            </p>

            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  {...emailForm.register("email")}
                  className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {emailForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={emailForm.formState.isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-60"
              >
                {emailForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {emailForm.formState.isSubmitting ? "Sending…" : "Generate reset token"}
              </button>
            </form>
          </>
        )}

        {stage === "reset" && token && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
              <KeyRound className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Demo token</span> — normally this is
                emailed to you. It expires in 30 minutes.
              </p>
            </div>
            <code className="mt-3 block select-all break-all rounded-lg border border-input bg-card/70 px-3 py-2 text-xs text-primary">
              {token}
            </code>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">For {email}</p>

            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...resetForm.register("newPassword")}
                  className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {resetForm.formState.errors.newPassword && (
                  <p className="mt-1 text-xs text-destructive">
                    {resetForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat the new password"
                  {...resetForm.register("confirm")}
                  className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {resetForm.formState.errors.confirm && (
                  <p className="mt-1 text-xs text-destructive">
                    {resetForm.formState.errors.confirm.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={resetForm.formState.isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-60"
              >
                {resetForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {resetForm.formState.isSubmitting ? "Updating…" : "Set new password"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setStage("email");
                setSent(false);
              }}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different email
            </button>
          </>
        )}

        {stage === "done" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">
              {sent && token ? "Password updated" : "Reset token generated"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sent && token
                ? "You can sign in with your new password now."
                : "If an account exists for that email, a reset token has been generated for it."}
            </p>
            <Link
              to="/auth/login"
              className="mt-6 inline-flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
