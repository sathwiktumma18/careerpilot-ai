import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Briefcase,
  ExternalLink,
  Github,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Settings,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FadeIn } from "@/components/common/Motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { avatarSrc, portfolioService } from "@/services/api";
import type { PortfolioProfile } from "@/lib/portfolio";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — CareerPilot" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const isRecruiter = user?.role === "recruiter";
  const [profile, setProfile] = useState<PortfolioProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await portfolioService.getMe();
        const p = await portfolioService.getPublic(me.slug);
        if (!cancelled) setProfile(p);
      } catch {
        // No portfolio yet — the page still shows the account shell.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const avatar = avatarSrc(profile?.avatarUrl);
  const headline = profile?.headline || (isRecruiter ? "Recruiter" : "");
  const socials = [
    profile?.linkedinUrl ? { label: "LinkedIn", href: profile.linkedinUrl, icon: Linkedin } : null,
    profile?.githubUrl ? { label: "GitHub", href: profile.githubUrl, icon: Github } : null,
    profile?.portfolioUrl
      ? { label: "Website", href: profile.portfolioUrl, icon: ExternalLink }
      : null,
  ].filter((s): s is { label: string; href: string; icon: typeof Linkedin } => Boolean(s));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Your public profile"
        description={
          isRecruiter
            ? "How candidates see you on your recruiter portfolio."
            : "How recruiters see you on your portfolio and in the directory."
        }
        actions={
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm font-medium transition hover:bg-card"
          >
            <Settings className="h-4 w-4" /> Edit in settings
          </Link>
        }
      />

      <FadeIn>
        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Loading your public profile…</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="gradient-border relative overflow-hidden rounded-3xl p-8">
              <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)]" />
              <div className="relative flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 border-4 border-background/60">
                  {avatar && <AvatarImage src={avatar} alt={user.name} />}
                  <AvatarFallback className="bg-[image:var(--gradient-primary)] text-3xl text-white">
                    {user.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-2xl font-bold tracking-tight">{user.name}</h2>
                {headline && <p className="mt-1 text-sm text-muted-foreground">{headline}</p>}

                {(profile?.location || isRecruiter) && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    {profile?.location && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1">
                        <MapPin className="h-3 w-3" /> {profile.location}
                      </span>
                    )}
                    {profile && (profile.yearsExperience ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1">
                        <Briefcase className="h-3 w-3" /> {profile.yearsExperience} yrs
                      </span>
                    )}
                    {isRecruiter && profile?.company && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">
                        <Briefcase className="h-3 w-3" /> {profile.company}
                      </span>
                    )}
                  </div>
                )}

                {profile?.summary && (
                  <p className="mt-5 max-w-lg text-sm leading-relaxed text-foreground/85">
                    {profile.summary}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {user.email}
                  </span>
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs transition hover:border-primary/40 hover:text-primary"
                    >
                      <s.icon className="h-3.5 w-3.5" /> {s.label}
                    </a>
                  ))}
                </div>

                {profile && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-xs">
                    <span className="text-muted-foreground">Public page:</span>
                    <a
                      href={`/p/${profile.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      /p/{profile.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </FadeIn>
    </AppShell>
  );
}
