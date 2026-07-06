/**
 * Frontend service layer for CareerPilot AI.
 *
 * These services front the FastAPI backend (see /backend). While the backend
 * is being built out, they operate on the local Zustand stores so the UI is
 * fully functional end-to-end. Swap the internals to `fetch(BASE_URL + ...)`
 * without changing the public method signatures.
 */
import {
  useAuthStore,
  useResumeStore,
  useSettingsStore,
  useNotificationStore,
  type ResumeRecord,
  type Settings,
  type User,
  type NotificationItem,
} from "@/lib/store";
import { generateAnalysis, type Analysis } from "@/lib/analysis-generator";
import { generateAnalysisAsync } from "@/lib/analysis-runner";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateAnalysisOffThread(id: string, fileName: string): Promise<Analysis> {
  if (typeof Worker === "undefined") {
    return generateAnalysis(id, fileName);
  }

  return await new Promise<Analysis>((resolve, reject) => {
    const worker = new Worker(new URL("../lib/analysis-worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => {
      resolve(event.data.analysis as Analysis);
      worker.terminate();
    };

    worker.onerror = (event) => {
      reject(event.error ?? new Error("Analysis worker failed"));
      worker.terminate();
    };

    worker.postMessage({ id, fileName });
  });
}

/* --------------------------------- Auth ----------------------------------- */

export const authService = {
  async login(email: string, password: string): Promise<User> {
    return useAuthStore.getState().login(email, password);
  },
  async signup(name: string, email: string, password: string): Promise<User> {
    return useAuthStore.getState().signup(name, email, password);
  },
  async forgotPassword(email: string): Promise<void> {
    return useAuthStore.getState().requestPasswordReset(email);
  },
  logout(): void {
    useAuthStore.getState().logout();
  },
};

/* -------------------------------- Resumes --------------------------------- */

export const resumeService = {
  async upload(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ id: string; fileName: string }> {
    // Simulated chunked upload with progress. Backend equivalent:
    // POST /api/upload  (multipart/form-data)
    for (let p = 0; p <= 100; p += 8) {
      onProgress?.(Math.min(p, 100));
      await sleep(70);
    }
    const record = useResumeStore.getState().addResume({ name: file.name, size: file.size });
    return { id: record.id, fileName: record.fileName };
  },

  async analyze(id: string): Promise<ResumeRecord> {
    // Simulate a backend analysis pass and keep the UI thread responsive.
    // The actual mock work is offloaded to a Web Worker when available.
    const record = useResumeStore.getState().getResume(id);
    if (!record) throw new Error("Resume not found");

    await sleep(900);
    const analysis = await generateAnalysisOffThread(id, record.fileName);
    useResumeStore.getState().updateResumeAnalysis(id, analysis);
    useNotificationStore.getState().push({
      title: "Resume analysis complete",
      detail: `${record.fileName} — ATS ${analysis.atsScore}`,
      kind: "resume",
    });

    const updated = useResumeStore.getState().getResume(id);
    if (!updated) throw new Error("Resume not found after analysis");
    return updated;
  },

  async list(): Promise<ResumeRecord[]> {
    await sleep(120);
    return useResumeStore.getState().resumes;
  },

  async get(id: string): Promise<ResumeRecord | null> {
    await sleep(120);
    return useResumeStore.getState().getResume(id) ?? null;
  },

  async remove(id: string): Promise<void> {
    await sleep(120);
    useResumeStore.getState().removeResume(id);
  },
};

/* -------------------------------- Profile --------------------------------- */

export const profileService = {
  async get(): Promise<User | null> {
    await sleep(80);
    return useAuthStore.getState().user;
  },
  async update(patch: Partial<User>): Promise<User | null> {
    await sleep(180);
    useAuthStore.getState().updateProfile(patch);
    return useAuthStore.getState().user;
  },
};

/* -------------------------------- Settings -------------------------------- */

export const settingsService = {
  async get(): Promise<Settings> {
    await sleep(80);
    return useSettingsStore.getState().settings;
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    await sleep(220);
    useSettingsStore.getState().save(patch);
    return useSettingsStore.getState().settings;
  },
};

/* ----------------------------- Notifications ------------------------------ */

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    await sleep(80);
    return useNotificationStore.getState().items;
  },
  async markAllRead(): Promise<void> {
    useNotificationStore.getState().markAllRead();
  },
  async clear(): Promise<void> {
    useNotificationStore.getState().clear();
  },
};

/* -------------------------------- Dashboard ------------------------------- */

export const dashboardService = {
  async get() {
    await sleep(120);
    const resumes = useResumeStore.getState().resumes;
    const activity = useNotificationStore.getState().items.slice(0, 6);
    const avgAts = resumes.length
      ? Math.round(resumes.reduce((a, r) => a + r.analysis.atsScore, 0) / resumes.length)
      : 0;
    const matchedRoles = resumes.reduce(
      (a, r) => a + r.analysis.recommendedRoles.length,
      0,
    );
    return {
      stats: [
        { label: "Resumes Analyzed", value: String(resumes.length), delta: resumes.length ? "+1 this week" : "—", trend: "up" as const },
        { label: "Avg ATS Score", value: String(avgAts || "—"), delta: avgAts ? `${avgAts >= 75 ? "Strong" : "Growing"}` : "—", trend: "up" as const },
        { label: "Matched Roles", value: String(matchedRoles), delta: matchedRoles ? `+${Math.min(matchedRoles, 12)}` : "—", trend: "up" as const },
        { label: "Interviews Ready", value: String(Math.max(0, Math.floor(avgAts / 10))), delta: avgAts ? "+2" : "—", trend: "up" as const },
      ],
      activity,
    };
  },
};

export const api = {
  authService,
  resumeService,
  profileService,
  settingsService,
  notificationService,
  dashboardService,
};
