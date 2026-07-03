import { motion } from "framer-motion";
import { Sparkles, type LucideIcon } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function ComingSoon({
  module,
  description,
  icon: Icon = Sparkles,
  features,
}: {
  module: string;
  description: string;
  icon?: LucideIcon;
  features: { title: string; detail: string; icon: LucideIcon }[];
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Coming soon"
        title={module}
        description={description}
        actions={
          <button className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card">
            Notify me
          </button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative overflow-hidden rounded-3xl p-10 text-center"
      >
        <div className="absolute inset-0 bg-[image:var(--gradient-glow)]" />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold">{module} is on the roadmap</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            We're actively building this module. Join the waitlist to get early access and shape
            the launch.
          </p>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              className="glass rounded-2xl p-5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
