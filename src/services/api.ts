/**
 * Frontend service layer.
 * Points at the FastAPI backend (see /backend). Swap BASE_URL via VITE_API_URL.
 * All endpoints are stubbed with mock responses so the UI is fully interactive
 * before the backend is wired up.
 */
import { mockAnalysis, type Analysis } from "@/lib/mockData";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const resumeService = {
  async upload(file: File, onProgress?: (pct: number) => void): Promise<{ id: string; fileName: string }> {
    // Simulated progressive upload. Replace with real fetch/XHR when backend is live.
    for (let p = 0; p <= 100; p += 8) {
      onProgress?.(Math.min(p, 100));
      await sleep(90);
    }
    return { id: crypto.randomUUID(), fileName: file.name };
  },

  async analyze(id: string): Promise<Analysis> {
    await sleep(1600);
    return { ...mockAnalysis };
  },
};

export const profileService = {
  async get() {
    await sleep(200);
    return {
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      plan: "Pro",
      avatarUrl: null as string | null,
    };
  },
};

export const dashboardService = {
  async get() {
    await sleep(200);
    const { mockDashboardStats, mockActivity } = await import("@/lib/mockData");
    return { stats: mockDashboardStats, activity: mockActivity };
  },
};

export const api = { request, resumeService, profileService, dashboardService };
