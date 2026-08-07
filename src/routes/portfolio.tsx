/**
 * PortfolioAI manager — the in-app control room for the public `/p/{slug}` page.
 * Shows the live share link (with a copy button), lets you pick the accent hue
 * that tints the whole page, and renders a live preview from real resume data.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Sparkles,
  Upload,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FadeIn, Stagger, StaggerItem } from "@/components/common/Motion";
import { Gauge } from "@/components/common/Gauge";
import { portfolioService } from "@/services/api";
import { useAuthStore } from "@/lib/store";
import type { PortfolioProfile } from "@/lib/portfolio";
import {
  ACCENT_HUES,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT_HUE,
  applyAccentHue,
  getSavedAccentHue,
} from "@/lib/accent";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "PortfolioAI — CareerPilot AI" }] }),
  component: PortfolioManager,
});

function PortfolioManager() {
  const user = useAuthStore((s) => s.user);
  const [slug, setSlug] = useState<string | null>(null);
  const [preview, setPreview] = useState<PortfolioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accentHue, setAccentHue] = useState<number>(DEFAULT_ACCENT_HUE);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = getSavedAccentHue() ?? DEFAULT_ACCENT_HUE;
    setAccentHue(saved);
    applyAccentHue(saved);
    portfolioService
      .getMe()
      .then(async (me) => {
        setSlug(me.slug);
        try {
          setPreview(await portfolioService.getPublic(me.slug));
        } catch {
          setPreview(null); // no analyzed resume yet — the preview shows the shell
        }
      })
      .catch(() => toast.error("Could not load your portfolio"))
      .finally(() => setLoading(false));
  }, []);

  function selectAccent(hue: number) {
    setAccentHue(hue);
    applyAccentHue(hue);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, String(hue));
    } catch {
      /* storage unavailable — accent applies for this session only */
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = slug ? `${origin}/p/${slug}?hue=${accentHue}` : "";

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Portfolio link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="PortfolioAI"
        title="Your shareable portfolio"
        description="A premium, ATS-grade portfolio page built from your real resume data — send the link to recruiters, no account needed on their end."
        actions={
          slug ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" /> Open portfolio
            </a>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">Preparing your portfolio…</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controls */}
          <FadeIn>
            <div className="space-y-5">
              {/* Share link */}
              <div className="glass rounded-2xl p-6">
                <div className="text-sm font-semibold">Share your portfolio</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Anyone with this link can view your public page — no sign-in required.
                </p>
                {slug ? (
                  <>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
                        {shareUrl}
                      </div>
                      <button
                        onClick={copyLink}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2.5 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Your public URL is{" "}
                      <span className="font-medium text-foreground">/p/{slug}</span> — it updates
                      automatically whenever you re-analyze a resume.
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">Loading your public link…</p>
                )}
              </div>

              {/* Accent picker */}
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Palette className="h-4 w-4 text-primary" /> Accent color
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tints the gradient identity of your portfolio page. Picked colors are baked into
                  the shared link.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {ACCENT_HUES.map((a) => (
                    <button
                      key={a.hue}
                      onClick={() => selectAccent(a.hue)}
                      title={a.name}
                      aria-label={`Set accent to ${a.name}`}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition hover:scale-110",
                        accentHue === a.hue ? "border-foreground" : "border-transparent",
                      )}
                      style={{
                        background: `oklch(0.65 0.19 ${a.hue})`,
                        boxShadow:
                          accentHue === a.hue
                            ? `0 0 20px oklch(0.65 0.19 ${a.hue} / 0.5)`
                            : undefined,
                      }}
                    >
                      {accentHue === a.hue && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="glass rounded-2xl p-6">
                <div className="text-sm font-semibold">How it works</div>
                <Stagger className="mt-4 space-y-3">
                  {[
                    {
                      icon: Upload,
                      title: "Upload & analyze",
                      detail:
                        "Analyze a resume — the strongest one becomes your portfolio headline.",
                      to: "/resume/upload" as const,
                    },
                    {
                      icon: Sparkles,
                      title: "Automatic refresh",
                      detail: "Re-analyze or add a version and your public page updates instantly.",
                    },
                    {
                      icon: ExternalLink,
                      title: "Share the link",
                      detail:
                        "Copy your public URL and send it anywhere — recruiters, LinkedIn, email.",
                    },
                  ].map((step) => {
                    const Icon = step.icon;
                    return (
                      <StaggerItem key={step.title} className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {step.to ? (
                              <Link to={step.to} className="hover:text-primary">
                                {step.title}
                              </Link>
                            ) : (
                              step.title
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{step.detail}</div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              </div>
            </div>
          </FadeIn>

          {/* Live preview */}
          <FadeIn delay={0.08}>
            <div className="lg:sticky lg:top-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live preview
                </div>
                {!preview && (
                  <span className="rounded-full bg-[color:var(--warning)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--warning)]">
                    No analysis yet
                  </span>
                )}
              </div>
              <div className="gradient-border relative overflow-hidden rounded-3xl p-8">
                <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Public portfolio
                  </div>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight">
                    <span className="gradient-text">
                      {preview?.name ?? user?.name ?? "Your name"}
                    </span>
                  </h2>
                  {preview?.headline && (
                    <p className="mt-1 text-sm text-muted-foreground">{preview.headline}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {preview?.location && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {preview.location}
                      </span>
                    )}
                    {preview && preview.yearsExperience > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground">
                        <Briefcase className="h-3 w-3" /> {preview.yearsExperience} yrs
                      </span>
                    )}
                  </div>
                  <div className="mt-6 flex items-center justify-center">
                    <Gauge score={preview?.atsScore ?? 0} size={128} sublabel="ATS fit" />
                  </div>
                  {!preview && (
                    <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 p-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Upload and analyze a resume to fill your portfolio with skills, ATS history,
                        and recommended roles.
                      </p>
                      <Link
                        to="/resume/upload"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-glow)]"
                      >
                        <Upload className="h-3.5 w-3.5" /> Analyze a resume
                      </Link>
                    </div>
                  )}
                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{preview?.email ?? user?.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      )}
    </AppShell>
  );
}
