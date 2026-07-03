import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Github, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — CareerPilot AI" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

function AuthPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

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
              Welcome back
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Sign in to your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Continue where you left off with your AI career copilot.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-card">
            <Github className="h-4 w-4" /> GitHub
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-card">
            <Mail className="h-4 w-4" /> Google
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or continue with email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form
          onSubmit={handleSubmit(async () => {
            await new Promise((r) => setTimeout(r, 600));
            navigate({ to: "/dashboard" });
          })}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              {...register("email")}
              className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[image:var(--gradient-primary)] py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No account? <span className="text-primary">Start a 14-day trial →</span>
        </p>
      </motion.div>
    </div>
  );
}
