import { describe, expect, it } from "vitest";
import { pickNaturalVoice, rankVoice } from "./speech";

// Stub voices that mirror real browser offerings (name + lang + localService).
const VOICES = [
  { name: "Microsoft David", lang: "en-US", localService: true },
  { name: "Microsoft Zira", lang: "en-US", localService: true },
  { name: "Microsoft Neerja", lang: "en-IN", localService: true },
  { name: "Microsoft Aria Online (Natural)", lang: "en-US", localService: false },
  { name: "Google UK English Female", lang: "en-GB", localService: false },
  { name: "Google US English", lang: "en-US", localService: false },
  { name: "Google हिन्दी", lang: "hi-IN", localService: false },
] as { name: string; lang: string; localService?: boolean }[];

describe("rankVoice", () => {
  it("prefers India English over US/UK English over non-English", () => {
    const byRank = (v: { name: string; lang: string }) => rankVoice(v);
    const neerja = byRank(VOICES[2]); // en-IN
    const aria = byRank(VOICES[3]); // en-US natural
    const david = byRank(VOICES[0]); // en-US robotic
    const hindi = byRank(VOICES[6]); // hi-IN
    expect(neerja).toBeGreaterThan(aria);
    expect(aria).toBeGreaterThan(david);
    expect(david).toBeGreaterThan(hindi);
  });

  it("boosts natural-sounding voice names over robotic ones at the same lang", () => {
    expect(rankVoice(VOICES[3])).toBeGreaterThan(rankVoice(VOICES[0])); // Aria > David
    expect(rankVoice(VOICES[4])).toBeGreaterThan(rankVoice(VOICES[0])); // Google UK > David
  });
});

describe("pickNaturalVoice", () => {
  it("picks the top-ranked natural English voice (en-IN beats robotic en-US)", () => {
    const picked = pickNaturalVoice(VOICES as unknown as SpeechSynthesisVoice[]);
    expect(picked?.name).toBe("Microsoft Neerja");
  });

  it("returns null when no voices are available", () => {
    expect(pickNaturalVoice([])).toBeNull();
  });
});
