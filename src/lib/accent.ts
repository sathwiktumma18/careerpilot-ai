/**
 * Accent-hue theming. The portfolio manager lets the user pick an accent hue
 * (an oklch H value); we persist it in localStorage and apply it as
 * `--accent-hue` on `:root`. The public portfolio page can also read it from a
 * `?hue=` query param so a shared link carries the owner's chosen accent.
 */

export const ACCENT_STORAGE_KEY = "careerpilot.accentHue";

export const ACCENT_HUES: { name: string; hue: number }[] = [
  { name: "Ocean", hue: 258 },
  { name: "Violet", hue: 285 },
  { name: "Emerald", hue: 160 },
  { name: "Amber", hue: 75 },
  { name: "Coral", hue: 20 },
  { name: "Rose", hue: 340 },
];

export const DEFAULT_ACCENT_HUE = 258;

/** Apply a hue globally. Call from a client-only effect. */
export function applyAccentHue(hue: number | string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent-hue", String(hue));
}

export function getSavedAccentHue(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  if (!raw) return null;
  const hue = Number(raw);
  return Number.isFinite(hue) ? hue : null;
}
