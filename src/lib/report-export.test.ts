import { describe, expect, it } from "vitest";
import { wrapForExport } from "./report-export";

describe("wrapForExport", () => {
  it("keeps short lines intact", () => {
    expect(wrapForExport("Hello world", 80)).toEqual(["Hello world"]);
  });

  it("wraps long text at word boundaries", () => {
    const text = "one two three four five six seven eight nine ten";
    const lines = wrapForExport(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
    // Reconstructing joins to the original (single-spaced) text.
    expect(lines.join(" ")).toBe(text);
  });

  it("handles empty input", () => {
    expect(wrapForExport("", 10)).toEqual([]);
  });
});
