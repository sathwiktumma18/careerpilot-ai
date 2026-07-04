import type { ReactNode } from "react";
import { FileQuestion, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-2xl p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="glass rounded-2xl border border-destructive/30 p-8 text-center">
      <div className="text-base font-semibold text-destructive">{title}</div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card"
        >
          Try again
        </button>
      )}
    </div>
  );
}
