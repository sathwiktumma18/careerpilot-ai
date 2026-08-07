import { createFileRoute } from "@tanstack/react-router";
import { forwardRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FadeIn } from "@/components/common/Motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import { profileService } from "@/services/api";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — CareerPilot" }] }),
  component: ProfilePage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  title: z.string().trim().min(2, "Title is required").max(80),
  location: z.string().trim().max(80),
  bio: z.string().trim().max(400),
  yearsExperience: z.coerce.number().int().min(0).max(60),
});

type FormValues = z.infer<typeof schema>;

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: user
      ? {
          name: user.name,
          email: user.email,
          title: user.title,
          location: user.location,
          bio: user.bio,
          yearsExperience: user.yearsExperience,
        }
      : undefined,
  });

  async function onSubmit(values: FormValues) {
    try {
      await profileService.update(values);
      reset(values);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update profile");
    }
  }

  if (!user) return null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your public CareerPilot identity."
      />

      <FadeIn>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
          <div className="glass rounded-2xl p-6 text-center">
            <Avatar className="mx-auto h-24 w-24">
              <AvatarFallback className="bg-[image:var(--gradient-primary)] text-2xl text-white">
                {user.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="mt-4 text-lg font-semibold">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.title}</div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {user.location && (
                <span className="rounded-full border border-border px-2 py-1">{user.location}</span>
              )}
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                {user.plan} plan
              </span>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold">Personal information</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name?.message} {...register("name")} />
              <Field
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register("email")}
              />
              <Field label="Job title" error={errors.title?.message} {...register("title")} />
              <Field label="Location" error={errors.location?.message} {...register("location")} />
              <Field
                label="Years of experience"
                type="number"
                min={0}
                max={60}
                error={errors.yearsExperience?.message}
                {...register("yearsExperience")}
              />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">About</div>
              <textarea
                rows={4}
                {...register("bio")}
                className="w-full rounded-lg border border-input bg-card/50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors.bio && <p className="mt-1 text-xs text-destructive">{errors.bio.message}</p>}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
              <button
                type="button"
                onClick={() => reset()}
                disabled={!isDirty || isSubmitting}
                className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isDirty || isSubmitting}
                className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? "Saving…" : "Save profile"}
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
