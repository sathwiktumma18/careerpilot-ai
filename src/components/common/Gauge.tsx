/**
 * Circular ATS gauge — extracted from the analysis page's ScoreRing so the
 * public portfolio and anywhere else can reuse it. The stroke draws itself in
 * on mount; the score sits centered inside unless `showValue` is off. The
 * gradient id is unique per instance, so multiple gauges can share a page.
 */
import { useId } from "react";
import { motion } from "framer-motion";

export function Gauge({
  score,
  size = 132,
  sublabel = "ATS score",
  showValue = true,
}: {
  score: number;
  size?: number;
  sublabel?: string;
  showValue?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clamped = Math.max(0, Math.min(100, score));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={`gauge-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.19 258)" />
            <stop offset="100%" stopColor="oklch(0.62 0.22 300)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={`url(#gauge-${uid})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold leading-none gradient-text">{score}</span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </span>
        </div>
      )}
    </div>
  );
}
