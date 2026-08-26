import { createFileRoute } from "@tanstack/react-router";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FadeIn } from "@/components/common/Motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { avatarSrc, profileService, type ApiProfile } from "@/services/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Account settings — CareerPilot" }] }),
  component: SettingsPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  headline: z.string().trim().max(120),
  location: z.string().trim().max(80),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  bio: z.string().trim().max(400),
  linkedinUrl: z.string().trim().max(300),
  githubUrl: z.string().trim().max(300),
  portfolioUrl: z.string().trim().max(300),
  company: z.string().trim().max(120),
  companyRole: z.string().trim().max(120),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  headline: "",
  location: "",
  yearsExperience: 0,
  bio: "",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  company: "",
  companyRole: "",
};

function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isRecruiter = user?.role === "recruiter";
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Load the real profile on mount — fields start EMPTY until the backend
  // answers, never pre-filled with demo data.
  useEffect(() => {
    let cancelled = false;
    profileService
      .get()
      .then((p: ApiProfile) => {
        if (cancelled) return;
        setAvatarUrl(avatarSrc(p.avatar_url));
        reset({
          name: p.name ?? "",
          headline: p.headline ?? "",
          location: p.location ?? "",
          yearsExperience: p.years_experience ?? 0,
          bio: p.bio ?? "",
          linkedinUrl: p.linkedin_url ?? "",
          githubUrl: p.github_url ?? "",
          portfolioUrl: p.portfolio_url ?? "",
          company: p.company ?? "",
          companyRole: p.company_role ?? "",
        });
      })
      .catch(() => !cancelled && toast.error("Could not load your profile"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reset]);

  async function onSubmit(values: FormValues) {
    try {
      await profileService.update({
        name: values.name || undefined,
        headline: values.headline || undefined,
        location: values.location || undefined,
        years_experience: values.yearsExperience || undefined,
        bio: values.bio || undefined,
        linkedin_url: values.linkedinUrl || undefined,
        github_url: values.githubUrl || undefined,
        portfolio_url: values.portfolioUrl || undefined,
        company: values.company || undefined,
        company_role: values.companyRole || undefined,
      });
      toast.success("Profile saved");
    } catch {
      toast.error("Could not save profile — try again");
    }
  }

  const pickPhoto = useCallback(() => fileRef.current?.click(), []);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setPhotoBusy(true);
    try {
      const url = await profileService.uploadAvatar(file);
      setAvatarUrl(avatarSrc(url));
      toast.success("Photo updated");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(detail || "Could not upload the photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await profileService.update({ avatar: "clear" });
      setAvatarUrl(undefined);
      toast.success("Photo removed");
    } catch {
      toast.error("Could not remove the photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Account"
          title="Account settings"
          description="Your public identity across CareerPilot."
        />
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">Loading your profile…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Account settings"
        description={
          isRecruiter
            ? "Your company identity — it feeds your recruiter portfolio."
            : "Your public identity — it feeds your portfolio and the recruiter directory."
        }
      />

      <FadeIn>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
          {/* ------------------------- Photo + identity ------------------------- */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-sm font-semibold">Profile photo</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Shown on your portfolio and in messages.
              </p>

              <div className="relative mx-auto mt-5 h-28 w-28">
                <Avatar className="h-28 w-28">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.name ?? "Avatar"} />}
                  <AvatarFallback className="bg-[image:var(--gradient-primary)] text-3xl text-white">
                    {user?.avatarInitials ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {photoBusy && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={pickPhoto}
                  disabled={photoBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" /> {avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => void removePhoto()}
                    disabled={photoBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void onFileSelected(e)}
              />
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-semibold">Account</div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium">{user?.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="inline-flex items-center gap-1 font-medium">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {isRecruiter ? "Recruiter" : "Job seeker"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {user?.plan ?? "Free"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Email is your sign-in identity and can't be changed here.
              </p>
            </div>
          </div>

          {/* --------------------------- Edit fields --------------------------- */}
          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold">Personal information</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name?.message} {...register("name")} />
              <Field
                label="Headline"
                placeholder="e.g. Frontend Engineer @ Acme"
                error={errors.headline?.message}
                {...register("headline")}
              />
              <Field
                label="Location"
                placeholder="e.g. Bengaluru"
                error={errors.location?.message}
                {...register("location")}
              />
              <Field
                label="Years of experience"
                type="number"
                min={0}
                max={60}
                error={errors.yearsExperience?.message}
                {...register("yearsExperience")}
              />
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <h3 className="text-sm font-semibold">About</h3>
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Bio {isRecruiter ? "(what you look for in candidates)" : "(what you do)"}
                </div>
                <textarea
                  rows={4}
                  {...register("bio")}
                  className="w-full rounded-lg border border-input bg-card/50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {errors.bio && (
                  <p className="mt-1 text-xs text-destructive">{errors.bio.message}</p>
                )}
              </div>
            </div>

            {isRecruiter && (
              <div className="mt-6 border-t border-border pt-6">
                <h3 className="text-sm font-semibold">Company</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown on your recruiter portfolio so candidates know who they're talking to.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Company"
                    placeholder="e.g. Acme Corp"
                    error={errors.company?.message}
                    {...register("company")}
                  />
                  <Field
                    label="Your role"
                    placeholder="e.g. Talent Lead"
                    error={errors.companyRole?.message}
                    {...register("companyRole")}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-border pt-6">
              <h3 className="text-sm font-semibold">Social links</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Public links shown on your portfolio page.
              </p>
              <div className="mt-4 grid gap-4">
                <Field
                  label="LinkedIn"
                  placeholder="https://linkedin.com/in/you"
                  error={errors.linkedinUrl?.message}
                  {...register("linkedinUrl")}
                />
                <Field
                  label="GitHub"
                  placeholder="https://github.com/you"
                  error={errors.githubUrl?.message}
                  {...register("githubUrl")}
                />
                <Field
                  label="Portfolio / website"
                  placeholder="https://yourportfolio.dev"
                  error={errors.portfolioUrl?.message}
                  {...register("portfolioUrl")}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
              <button
                type="button"
                onClick={() => reset(EMPTY)}
                disabled={!isDirty || isSubmitting}
                className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card disabled:opacity-40"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={!isDirty || isSubmitting}
                className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </FadeIn>
    </AppShell>
  );
}

const Field = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, type = "text", ...rest }, ref) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <input
        ref={ref}
        type={type}
        {...rest}
        className="h-10 w-full rounded-lg border border-input bg-card/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </label>
  );
});
