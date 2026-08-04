/**
 * Frontend service layer for CareerPilot AI.
 *
 * These services call the FastAPI backend (see /backend) and hydrate the local
 * Zustand stores so the UI reads reactively. The backend is the source of
 * truth for resumes; stores are a cache.
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
import type { Analysis } from "@/lib/analysis";
import { emptyAnalysis } from "@/lib/analysis";
import { mapAnalysisFromApi, type ApiAnalysis } from "@/lib/analysis-mapper";
import {
  mapJobLiteFromApi,
  mapJobMatchFromApi,
  type ApiJobLite,
  type ApiJobMatchResponse,
} from "@/lib/job-match-mapper";
import type { JobLite, JobMatchResponse } from "@/lib/job-match";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface ApiResumeListItem {
  id: string;
  file_name: string;
  status: string;
  ats_score: number | null;
  created_at: string;
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
    const form = new FormData();
    form.append("file", file, file.name);

    return await new Promise<{ id: string; fileName: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/resumes`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { id: string; file_name: string };
            resolve({ id: data.id, fileName: data.file_name });
          } catch {
            reject(new Error("Invalid upload response"));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(form);
    });
  },

  async analyze(id: string): Promise<ResumeRecord> {
    const raw = await request<ApiAnalysis>(`/resumes/${id}/analyze`, { method: "POST" });
    const analysis = mapAnalysisFromApi(raw);
    useResumeStore.getState().updateResumeAnalysis(id, analysis);
    useNotificationStore.getState().push({
      title: "Resume analysis complete",
      detail: `${analysis.fileName} — ATS ${analysis.atsScore}`,
      kind: "resume",
    });
    const record = useResumeStore.getState().getResume(id);
    if (!record) throw new Error("Resume not found after analysis");
    return record;
  },

  async list(): Promise<ResumeRecord[]> {
    const items = await request<ApiResumeListItem[]>("/resumes");
    const store = useResumeStore.getState();
    const records: ResumeRecord[] = items.map((item) => {
      const existing = store.getResume(item.id);
      return {
        id: item.id,
        fileName: item.file_name,
        sizeKb: 0,
        uploadedAt: item.created_at,
        analysis: existing?.analysis ?? emptyAnalysis(item.id, item.file_name),
      };
    });
    store.hydrate(records);
    return records;
  },

  async get(id: string): Promise<ResumeRecord | null> {
    const detail = await request<ApiResumeListItem & { analysis: ApiAnalysis | null }>(
      `/resumes/${id}`,
    );
    if (!detail.analysis) return null;
    const analysis = mapAnalysisFromApi(detail.analysis);
    useResumeStore.getState().updateResumeAnalysis(id, analysis);
    return useResumeStore.getState().getResume(id) ?? null;
  },

  async remove(id: string): Promise<void> {
    await request<void>(`/resumes/${id}`, { method: "DELETE" });
    useResumeStore.getState().removeResume(id);
  },
};

/* -------------------------------- Profile --------------------------------- */

export const profileService = {
  async get(): Promise<User | null> {
    return useAuthStore.getState().user;
  },
  async update(patch: Partial<User>): Promise<User | null> {
    useAuthStore.getState().updateProfile(patch);
    return useAuthStore.getState().user;
  },
};

/* -------------------------------- Settings -------------------------------- */

export const settingsService = {
  async get(): Promise<Settings> {
    return useSettingsStore.getState().settings;
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    useSettingsStore.getState().save(patch);
    return useSettingsStore.getState().settings;
  },
};

/* ----------------------------- Notifications ------------------------------ */

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
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
    const resumes = useResumeStore.getState().resumes;
    const activity = useNotificationStore.getState().items.slice(0, 6);
    const avgAts = resumes.length
      ? Math.round(resumes.reduce((a, r) => a + r.analysis.atsScore, 0) / resumes.length)
      : 0;
    const matchedRoles = resumes.reduce((a, r) => a + r.analysis.recommendedRoles.length, 0);
    return {
      stats: [
        {
          label: "Resumes Analyzed",
          value: String(resumes.length),
          delta: resumes.length ? "+1 this week" : "—",
          trend: "up" as const,
        },
        {
          label: "Avg ATS Score",
          value: String(avgAts || "—"),
          delta: avgAts ? `${avgAts >= 75 ? "Strong" : "Growing"}` : "—",
          trend: "up" as const,
        },
        {
          label: "Matched Roles",
          value: String(matchedRoles),
          delta: matchedRoles ? `+${Math.min(matchedRoles, 12)}` : "—",
          trend: "up" as const,
        },
        {
          label: "Interviews Ready",
          value: String(Math.max(0, Math.floor(avgAts / 10))),
          delta: avgAts ? "+2" : "—",
          trend: "up" as const,
        },
      ],
      activity,
    };
  },
};

/* -------------------------------- Job Match -------------------------------- */

export interface JobMatchParams {
  resumeId: string;
  jobDescription?: string;
  remoteOnly?: boolean;
  locations?: string[];
  limit?: number;
}

export const jobMatchService = {
  async match(params: JobMatchParams): Promise<JobMatchResponse> {
    const raw = await request<ApiJobMatchResponse>("/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_id: params.resumeId,
        job_description: params.jobDescription ?? "",
        remote_only: params.remoteOnly ?? false,
        locations: params.locations ?? [],
        limit: params.limit ?? 10,
      }),
    });
    const result = mapJobMatchFromApi(raw);
    useNotificationStore.getState().push({
      title: "Job matches refreshed",
      detail: `${result.results.length} roles ranked for ${result.resumeTitle}`,
      kind: "match",
    });
    return result;
  },

  async listJobs(): Promise<JobLite[]> {
    const raw = await request<ApiJobLite[]>("/jobs");
    return (raw ?? []).map(mapJobLiteFromApi);
  },
};

export const api = {
  authService,
  resumeService,
  profileService,
  settingsService,
  notificationService,
  dashboardService,
  jobMatchService,
};
