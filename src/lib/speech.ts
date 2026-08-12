/**
 * Web Speech API wrappers (Chrome/Edge/Safari — free, no backend involved).
 *
 * - TTS: `speechSynthesis` reads questions aloud on a *natural* voice when one
 *   is available (the browser default is often robotic). A voice-picker lets
 *   the user override; the choice persists in localStorage.
 * - STT: `SpeechRecognition` transcribes spoken answers into the answer box
 *   with live interim results while the user talks.
 *
 * Everything degrades to "not supported" cleanly when the API is absent, and
 * all access is window-guarded for SSR.
 */

/* ---------- minimal typings (SpeechRecognition is not in lib.dom yet) ---------- */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [i: number]: { transcript: string };
}
interface SpeechRecognitionResultListLike {
  length: number;
  [i: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
  resultIndex?: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

/* --------------------------------- TTS --------------------------------- */

const TTS_KEY = "careerpilot.tts";
const DEFAULT_VOICE_KEY = "careerpilot.tts.voice";

/** Names that hint at a natural rather than robotic voice. */
const NATURAL_HINT =
  /(natural|neural|premium|enhanced|online\(|aria|jenny|guy|samantha|daniel|karen|moira|tessa|google us english|google uk english|google hindi)/i;

function langRank(lang: string): number {
  const l = lang.toLowerCase();
  if (l.startsWith("en-in")) return 3;
  if (l.startsWith("en-gb") || l.startsWith("en-au") || l.startsWith("en-ca")) return 2;
  if (l.startsWith("en")) return 1;
  return 0;
}

/** Higher = more natural for this user (India-first English, then UK/US). */
export function rankVoice(v: { lang: string; name: string; localService?: boolean }): number {
  return langRank(v.lang) * 10 + (NATURAL_HINT.test(v.name) ? 2 : 0);
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

/** English voices only, natural-sounding preferred, India-first. */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

/**
 * Best available natural voice: persisted choice if still present, otherwise
 * the highest-ranked English voice (uses `rankVoice` so the passed-in list can
 * be a stub in tests).
 */
export function pickNaturalVoice(voices = getEnglishVoices()): SpeechSynthesisVoice | null {
  const saved =
    typeof localStorage !== "undefined" ? localStorage.getItem(DEFAULT_VOICE_KEY) : null;
  const match = saved ? voices.find((v) => v.name === saved) : undefined;
  if (match) return match;
  const sorted = [...voices].sort((a, b) => rankVoice(b) - rankVoice(a));
  return sorted[0] ?? null;
}

export function savePreferredVoice(name: string): void {
  try {
    localStorage.setItem(DEFAULT_VOICE_KEY, name);
  } catch {
    /* storage unavailable — ignore */
  }
}

let synthesizing = false;

export function speechTtsEnabled(): boolean {
  try {
    return localStorage.getItem(TTS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSpeechTtsEnabled(on: boolean): void {
  try {
    localStorage.setItem(TTS_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function _speak(text: string, voice: SpeechSynthesisVoice | null): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? (navigator.language || "en-US");
  utter.rate = 0.98; // slightly slower than default reads more naturally
  utter.pitch = 1;
  synthesizing = true;
  utter.onend = () => {
    synthesizing = false;
  };
  utter.onerror = () => {
    synthesizing = false;
  };
  window.speechSynthesis.speak(utter);
}

/** Read `text` aloud. Returns true if it actually started (TTS supported + on). */
export function speakText(text: string, voice: SpeechSynthesisVoice | null): boolean {
  if (!text || typeof window === "undefined" || !window.speechSynthesis || !speechTtsEnabled()) {
    return false;
  }
  _speak(text, voice);
  return true;
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  synthesizing = false;
}

export function isSpeaking(): boolean {
  return synthesizing;
}

/* --------------------------------- STT --------------------------------- */

export function recognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function _newRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export interface RecognizerHandlers {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export interface SpeechRecognizer {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

export function createRecognizer(handlers: RecognizerHandlers): SpeechRecognizer {
  let rec: SpeechRecognitionLike | null = null;
  let listening = false;

  function attach(r: SpeechRecognitionLike): void {
    r.lang = "en-US";
    r.continuous = false; // auto-stops after a natural pause → good UX
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e: SpeechRecognitionEventLike): void => {
      let interim = "";
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          handlers.onFinal?.(transcript);
        } else {
          interim += transcript;
        }
      }
      if (interim) handlers.onInterim?.(interim);
    };
    r.onerror = (e: { error?: string }): void => {
      // "no-speech" / "aborted" are normal enough — treat as a quiet stop.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        handlers.onError?.(e.error);
      }
      handlers.onEnd?.();
      listening = false;
    };
    r.onend = (): void => {
      listening = false;
      handlers.onEnd?.();
    };
  }

  return {
    get supported() {
      return recognitionSupported();
    },
    get listening() {
      return listening;
    },
    start() {
      if (listening || !recognitionSupported()) return;
      rec = _newRecognizer();
      if (!rec) return;
      attach(rec);
      try {
        rec.start();
        listening = true;
      } catch {
        listening = false;
        handlers.onError?.("recognition_start");
      }
    },
    stop() {
      rec?.stop(); // graceful → onend fires
    },
  };
}
