/**
 * Regression test for the "Something went wrong" crash on /dashboard.
 *
 * Older app versions persisted ResumeRecords before resume versioning existed.
 * Those snapshots can lack `versions` (and sometimes `analysis`), and every
 * page reads `r.versions.length` / `r.analysis.*` — so a stale snapshot made
 * the Dashboard throw during rehydration. The resume store's persist `merge`
 * now normalizes records to the current shape. This test drives the store
 * against a shimmed localStorage seeded with a stale snapshot.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  },
  configurable: true,
});

describe("useResumeStore rehydration", () => {
  beforeEach(() => {
    mem.clear();
    vi.resetModules(); // re-create the store so each case re-runs the merge
  });

  it("normalizes pre-versioning records that lack `versions`", async () => {
    mem.set(
      "careerpilot.resumes",
      JSON.stringify({
        state: {
          resumes: [
            {
              id: "stale-1",
              title: "old.pdf",
              fileName: "old.pdf",
              sizeKb: 10,
              uploadedAt: "2026-07-01T00:00:00Z",
              analysis: { atsScore: 55 },
            },
          ],
          selectedId: "stale-1",
        },
        version: 0,
      }),
    );

    const { useResumeStore } = await import("./store");
    await Promise.resolve(); // let the sync hydration settle
    const resumes = useResumeStore.getState().resumes;
    expect(resumes).toHaveLength(1);
    expect(resumes[0].versions).toEqual([]);
    expect(resumes[0].versionCount).toBe(1);
    expect(resumes[0].analysis.atsScore).toBe(55);
  });

  it("defaults a fully missing analysis to the empty analysis", async () => {
    mem.set(
      "careerpilot.resumes",
      JSON.stringify({
        state: {
          resumes: [{ id: "stale-2", title: "no-analysis.pdf" }],
          selectedId: null,
        },
        version: 0,
      }),
    );

    const { useResumeStore } = await import("./store");
    await Promise.resolve();
    const resumes = useResumeStore.getState().resumes;
    expect(resumes[0].analysis.atsScore).toBe(0);
    expect(resumes[0].analysis.keywordTrend).toEqual([]);
    expect(resumes[0].versions).toEqual([]);
  });
});
