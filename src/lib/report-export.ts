/**
 * Client-side PDF report export (pdf-lib). Builds a branded one-page A4 report
 * from an `Analysis` and downloads it. No server round-trip required.
 */
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { Analysis } from "./analysis";

const WIDTH = 595; // A4 portrait
const HEIGHT = 842;
const MARGIN = 46;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;

const PRIMARY = rgb(0.27, 0.42, 0.86);
const DARK = rgb(0.13, 0.16, 0.23);
const MUTED = rgb(0.42, 0.47, 0.56);

const severityColor = (severity: string) =>
  severity === "high"
    ? rgb(0.82, 0.25, 0.28)
    : severity === "medium"
      ? rgb(0.85, 0.6, 0.12)
      : PRIMARY;

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

export async function exportAnalysisReport(a: Analysis): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([WIDTH, HEIGHT]);
      y = HEIGHT - MARGIN;
    }
  };
  const line = (text: string, { size = 10, font: f = font, color = DARK, gap = 16 } = {}) => {
    ensureSpace(size);
    page.drawText(text, { x: MARGIN, y: y - size, size, font: f, color });
    y -= size + gap;
  };

  // Header band
  page.drawRectangle({ x: 0, y: HEIGHT - 92, width: WIDTH, height: 92, color: PRIMARY });
  page.drawText("CareerPilot AI", {
    x: MARGIN,
    y: HEIGHT - 58,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Resume Analysis Report", {
    x: MARGIN,
    y: HEIGHT - 74,
    size: 9,
    font: font,
    color: rgb(0.9, 0.93, 1),
  });
  page.drawText(`ATS Score: ${a.atsScore}/100`, {
    x: WIDTH - MARGIN - 120,
    y: HEIGHT - 58,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y = HEIGHT - 92 - 28;

  // Candidate header
  line(`${a.candidate.name} — ${a.candidate.title}`, { size: 16, font: bold, gap: 6 });
  const meta = [
    a.candidate.location,
    a.candidate.email,
    `${a.candidate.yearsExperience} yrs experience`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  line(meta, { size: 9, color: MUTED, gap: 20 });

  // Summary
  line("AI SUMMARY", { size: 11, font: bold, color: PRIMARY, gap: 6 });
  for (const l of wrap(a.summary, 82)) line(l, { size: 10, gap: 5 });
  y -= 10;

  // Score breakdown
  line("SCORE BREAKDOWN", { size: 11, font: bold, color: PRIMARY, gap: 8 });
  for (const b of a.scoreBreakdown) {
    line(`${b.label.padEnd(14)} ${String(b.score).padStart(3)} / 100`, { size: 10, gap: 6 });
  }
  y -= 8;

  // Detected skills
  if (a.detectedSkills.length) {
    line("DETECTED SKILLS", { size: 11, font: bold, color: PRIMARY, gap: 8 });
    const names = a.detectedSkills
      .slice(0, 12)
      .map((s) => `${s.name} (${s.level})`)
      .join("   ·   ");
    for (const l of wrap(names, 90)) line(l, { size: 10, gap: 6 });
    y -= 8;
  }

  // Suggestions
  if (a.suggestions.length) {
    line("TOP SUGGESTIONS", { size: 11, font: bold, color: PRIMARY, gap: 8 });
    for (const s of a.suggestions) {
      ensureSpace(34);
      page.drawRectangle({
        x: MARGIN,
        y: y - 22,
        width: 4,
        height: 14,
        color: severityColor(s.severity),
      });
      line(`${s.title}  [${s.severity}]`, { size: 10, font: bold, gap: 4 });
      for (const l of wrap(s.detail, 84)) line(l, { size: 9, color: MUTED, gap: 4 });
      y -= 4;
    }
    y -= 8;
  }

  // Recommended roles
  if (a.recommendedRoles.length) {
    line("RECOMMENDED ROLES", { size: 11, font: bold, color: PRIMARY, gap: 8 });
    for (const r of a.recommendedRoles) {
      line(`${r.role.padEnd(34)} ${String(r.match).padStart(3)}%   ${r.company} · ${r.location}`, {
        size: 10,
        gap: 7,
      });
    }
  }

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${a.fileName.replace(/\.[^.]+$/, "")}-report.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Convenience for tests: shared color helpers are internal, export the wrap fn.
export function wrapForExport(text: string, maxChars: number): string[] {
  return wrap(text, maxChars);
}

export const reportBrandColor = hexToRgb("#456ee0");
