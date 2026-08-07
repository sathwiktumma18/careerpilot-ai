/**
 * Public shareable portfolio — `/p/{slug}`. Deliberately NOT inside AppShell
 * and NOT behind RequireAuth: this is the page you send to recruiters. It's
 * built entirely from stored resume analysis (no AI on this path), fetched
 * client-side so it renders instantly and fails gracefully.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import { portfolioService } from "@/services/api";
import type { PortfolioProfile } from "@/lib/portfolio";
import { BackgroundFX } from "@/components/common/BackgroundFX";
import { Gauge } from "@/components/common/Gauge";
import { FadeIn, Section, Stagger, StaggerItem } from "@/components/common/Motion";
import { applyAccentHue, DEFAULT_ACCENT_HUE } from "@/lib/accent";

const searchSchema = z.object({
  hue: z.coerce.number().optional().catch(undefined),
});

export const Route = createFileRoute("/p/$slug")({
  head: () => ({ meta: [{ title: "Portfolio — CareerPilot AI" }] }),
  validateSearch: searchSchema,
  component: PublicPortfolio,
});

type LoadState =
  { status: "loading" } | { status: "error" } | { status: "ready"; p: PortfolioProfile };

function PublicPortfolio() {
  const { slug } = Route.useParams();
  const { hue } = Route.useSearch();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // A shared link can carry ?hue= so the page shows the owner's accent.
  useEffect(() => {
    applyAccentHue(hue ?? DEFAULT_ACCENT_HUE);
  }, [hue]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    portfolioService
      .getPublic(slug)
      .then((p) => !cancelled && setState({ status: "ready", p }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundFX />
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        <main className="flex-1">
          {state.status === "loading" && <Skeleton />}
          {state.status === "error" && <NotFound slug={slug} />}
          {state.status === "ready" && <PortfolioBody p={state.p} />}
        </main>
        <Footer />
      </div>
    </div>
  );
}

function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex items-center justify-between py-3"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold">CareerPilot Portfolio</span>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5" /> Built with CareerPilot AI
      </Link>
    </motion.header>
  );
}

function PortfolioBody({ p }: { p: PortfolioProfile }) {
  const history = p.atsHistory.map((pt) => ({
    name: `v${pt.versionNo}`,
    score: pt.atsScore ?? 0,
  }));

  return (
    <>
      {/* Hero */}
      <section className="grid items-center gap-10 py-10 lg:grid-cols-[1fr,auto] lg:py-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Public portfolio
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
            className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
          >
            <span className="gradient-text">{p.name}</span>
          </motion.h1>
          {p.headline && (
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
              className="mt-3 text-xl text-muted-foreground"
            >
              {p.headline}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: "easeOut" }}
            className="mt-5 flex flex-wrap gap-2"
          >
            {p.location && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {p.location}
              </span>
            )}
            {p.yearsExperience > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> {p.yearsExperience} yrs experience
              </span>
            )}
            {p.resumeFileName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />{" "}
                {p.resumeFileName}
              </span>
            )}
          </motion.div>
          {p.summary && (
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32, ease: "easeOut" }}
              className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground"
            >
              {p.summary}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href={`mailto:${p.email}?subject=Let's talk — I saw your portfolio`}
              className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-90"
            >
              <Mail className="h-4 w-4" /> Hire me
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
            >
              <Sparkles className="h-4 w-4" /> Build yours free
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="glass relative flex flex-col items-center justify-center rounded-3xl p-8"
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[image:var(--gradient-glow)]" />
          <div className="relative">
            <Gauge score={p.atsScore ?? 0} size={160} sublabel="ATS fit" />
          </div>
          <div className="relative mt-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">Profile strength</div>
            <div className="mt-0.5 text-sm font-semibold">
              {p.atsScore == null
                ? "No analysis yet"
                : p.atsScore >= 75
                  ? "Strong — hiring ready"
                  : p.atsScore >= 55
                    ? "Good — improving fast"
                    : "Needs work"}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Core skills */}
      {p.skills.length > 0 && (
        <Section
          eyebrow="Skills"
          title="Core skills"
          description="The technologies and tools this profile is strongest in."
        >
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.skills.map((s) => (
              <StaggerItem key={s.name}>
                <div className="glass rounded-xl px-4 py-3 transition hover:border-primary/40">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs font-semibold text-primary">{s.level}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${s.level}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {/* ATS history + score breakdown */}
      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {history.length > 0 && (
          <FadeIn>
            <div className="glass h-full rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" /> ATS score over versions
              </div>
              <div className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="phist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.65 0.19 258)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.62 0.22 300)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="oklch(0.68 0.03 260)" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="oklch(0.68 0.03 260)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.2 0.025 265)",
                        border: "1px solid oklch(1 0 0 / 0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="oklch(0.65 0.19 258)"
                      strokeWidth={2}
                      fill="url(#phist)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeIn>
        )}

        {p.scoreBreakdown.length > 0 && (
          <FadeIn delay={0.08}>
            <div className="glass h-full rounded-2xl p-6">
              <div className="text-sm font-semibold">Where it counts</div>
              <div className="mt-4 space-y-4">
                {p.scoreBreakdown.map((b) => (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className="font-medium">{b.score}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${b.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Recommended roles */}
      {p.recommendedRoles.length > 0 && (
        <Section
          className="mt-14"
          eyebrow="Career fit"
          title="Recommended roles"
          description="Roles ranked against this profile by the CareerPilot AI matcher."
        >
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.recommendedRoles.map((r) => (
              <StaggerItem key={`${r.role}-${r.company}`}>
                <div className="group glass rounded-2xl p-5 transition hover:-translate-y-1 hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{r.role}</div>
                    <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {r.match}%
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.company}
                    {r.location ? ` · ${r.location}` : ""}
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${r.match}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {/* Updated stamp */}
      {p.updatedAt && (
        <FadeIn className="mt-14">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Last updated{" "}
            {new Date(p.updatedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </FadeIn>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="py-10">
      <FadeIn>
        <div className="gradient-border relative overflow-hidden rounded-3xl p-10 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight">Want to reach out?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              This portfolio was generated by CareerPilot AI — get the same premium, ATS-optimized
              portfolio for your own resume.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" /> Create your portfolio
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <LinkIcon className="h-4 w-4" /> CareerPilot AI
              </Link>
            </div>
          </div>
        </div>
      </FadeIn>
    </footer>
  );
}

function Skeleton() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">Loading portfolio…</p>
    </div>
  );
}

function NotFound({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-6xl font-bold gradient-text">404</div>
      <h1 className="mt-4 text-xl font-semibold">Portfolio not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We couldn't find a portfolio at <span className="font-medium text-foreground">/{slug}</span>
        . It may have been removed, or the link is incorrect.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5"
      >
        <ArrowUpRight className="h-4 w-4" /> Go to CareerPilot AI
      </Link>
    </div>
  );
}
