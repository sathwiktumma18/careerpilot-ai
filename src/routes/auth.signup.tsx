import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Github, Mail, Briefcase, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authService } from "@/services/api";
import type { UserRole } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Create account — CareerPilot AI" }] }),
  component: SignupPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type OAuthProvider = "google" | "github";

const ROLES: { value: UserRole; label: string; blurb: string; icon: typeof Briefcase }[] = [
  {
    value: "job_seeker",
    label: "Job Seeker",
    blurb: "Resume analysis, job matching, interviews & roadmap",
    icon: UserRound,
  },
  {
    value: "recruiter",
    label: "Recruiter",
    blurb: "Candidate pool, messaging & your own portfolio",
    icon: Briefcase,
  },
];

function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("job_seeker");
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await authService.signup(values.name, values.email, values.password, role);
      toast.success(role === "recruiter" ? "Recruiter account created" : "Account created");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    }
  }

  async function startOAuth(provider: OAuthProvider) {
    if (oauthBusy) return;
    setOauthBusy(provider);
    try {
      const url = await authService.oauthStart(provider);
      if (url) {
        // Full-page redirect to the provider; the callback route finishes signup.
        window.location.href = url;
        return;
      }
      toast.info("Social sign-in isn't configured yet — use email for now.");
    } catch {
      toast.error("Could not start social sign-in");
    }
    setOauthBusy(null);
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
              Start free
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI career copilot — free to get started.
        </p>

        {/* Role picker — a job seeker gets the full product; a recruiter gets a
            candidate dashboard + messaging instead. */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {ROLES.map(({ value, label, blurb, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                role === value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border bg-card/40 hover:border-primary/40",
              )}
            >
              <Icon
                className={cn("h-4 w-4", role === value ? "text-primary" : "text-muted-foreground")}
              />
              <div className="mt-2 text-sm font-medium">{label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{blurb}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground transition hover:bg-card disabled:opacity-50"
          >
            <Github className="h-4 w-4" />
            GitHub (Coming soon)
          </button>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground transition hover:bg-card disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            Google (Coming soon)
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or sign up with email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              {...register("name")}
              className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
              className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:underline">
            Sign in →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
