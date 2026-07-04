import { createFileRoute } from "@tanstack/react-router";
import { forwardRef } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/lib/store";
import { settingsService } from "@/services/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — CareerPilot" }] }),
  component: SettingsPage,
});

const tabs = ["General", "AI Preferences", "Billing", "Team", "API Keys"] as const;

const schema = z.object({
  workspaceName: z.string().trim().min(2, "Workspace name is required").max(60),
  subdomain: z
    .string()
    .trim()
    .min(3, "Subdomain is required")
    .max(60)
    .regex(/^[a-z0-9.-]+$/i, "Only letters, numbers, dots, dashes"),
  supportEmail: z.string().trim().email("Enter a valid email"),
  timezone: z.string().trim().min(2, "Timezone is required"),
  aiModel: z.enum(["Standard", "Pro", "Ultra"]),
  emailNotifications: z.boolean(),
  weeklyDigest: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("General");
  const settings = useSettingsStore((s) => s.settings);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  });

  const aiModel = watch("aiModel");

  async function onSubmit(values: FormValues) {
    try {
      await settingsService.update(values);
      reset(values);
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    }
  }

  function onCancel() {
    reset(settings);
    toast.info("Changes discarded");
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your workspace, AI preferences, and billing."
      />

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition",
              t === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Workspace</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Workspace name" error={errors.workspaceName?.message} {...register("workspaceName")} />
            <Field label="Subdomain" error={errors.subdomain?.message} {...register("subdomain")} />
            <Field label="Support email" type="email" error={errors.supportEmail?.message} {...register("supportEmail")} />
            <Field label="Time zone" error={errors.timezone?.message} {...register("timezone")} />
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">AI model</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the reasoning model for resume and interview analysis.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["Standard", "Pro", "Ultra"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setValue("aiModel", m, { shouldDirty: true })}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    aiModel === m
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="text-sm font-medium">{m}</div>
                  <div className="text-xs text-muted-foreground">
                    {m === "Standard"
                      ? "Fast, cost-effective"
                      : m === "Pro"
                        ? "Balanced quality & speed"
                        : "Deepest reasoning"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-6 space-y-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <Toggle label="Product email notifications" {...register("emailNotifications")} />
            <Toggle label="Weekly digest" {...register("weeklyDigest")} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
            <button
              type="button"
              onClick={onCancel}
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
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold">Danger zone</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting your workspace is permanent.
          </p>
          <button
            type="button"
            onClick={() => toast.error("Workspace deletion requires owner confirmation")}
            className="mt-4 w-full rounded-lg border border-destructive/40 bg-destructive/10 py-2 text-sm text-destructive transition hover:bg-destructive/20"
          >
            Delete workspace
          </button>
        </div>
      </form>
    </AppShell>
  );
}

const Field = (() => {
  const F = (
    { label, error, type = "text", ...rest }: React.InputHTMLAttributes<HTMLInputElement> & {
      label: string;
      error?: string;
    },
    ref: React.Ref<HTMLInputElement>,
  ) => (
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
  return (require("react") as typeof import("react")).forwardRef(F);
})();

const Toggle = (() => {
  const T = (
    { label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
    ref: React.Ref<HTMLInputElement>,
  ) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input ref={ref} type="checkbox" {...rest} className="h-4 w-4 accent-primary" />
    </label>
  );
  return (require("react") as typeof import("react")).forwardRef(T);
})();
