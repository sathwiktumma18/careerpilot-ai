import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  index = 0,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  index?: number;
}) {
  const Arrow = trend === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="glass rounded-2xl p-5"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
              trend === "up"
                ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
                : "bg-destructive/10 text-destructive",
            )}
          >
            <Arrow className="h-3 w-3" />
            {delta}
          </div>
        )}
      </div>
    </motion.div>
  );
}
