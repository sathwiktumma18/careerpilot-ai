/**
 * Fixed animated aurora orbs behind the app + public pages. Purely decorative:
 * pointer-events-none, cheap blurred gradients, a slow gentle float. Hues come
 * from `--accent-hue` so the portfolio accent switcher retints everything.
 * Render it first inside a `relative` page root; keep page content `relative
 * z-10` so it sits above the orbs.
 */
import { motion } from "framer-motion";

export function BackgroundFX() {
  const hue = "var(--accent-hue, 258)";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full blur-[120px]"
        style={{ background: `oklch(0.65 0.19 ${hue} / 0.16)` }}
        animate={{ x: [0, 48, 0], y: [0, 28, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full blur-[120px]"
        style={{ background: "oklch(0.62 0.22 300 / 0.13)" }}
        animate={{ x: [0, -56, 0], y: [0, 36, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full blur-[120px]"
        style={{ background: "oklch(0.72 0.17 200 / 0.10)" }}
        animate={{ x: [0, 40, 0], y: [0, -28, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
