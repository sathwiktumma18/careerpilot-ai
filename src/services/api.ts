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
import {
  mapInterviewFeedbackFromApi,
  mapInterviewSessionFromApi,
  type ApiInterviewFeedback,
  type ApiInterviewSession,
} from "@/lib/interview-mapper";
import type { Difficulty, InterviewFeedback, InterviewSession } from "@/lib/interview";
import { mapRoadmapFromApi, type ApiRoadmapPlan } from "@/lib/roadmap-mapper";
import type { RoadmapPlan } from "@/lib/roadmap";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/** The backend's auth payload — the subset of the user we keep client-side. */
interface ApiUser {
  id: string;
  email: string;
  name: string;
}

interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";

/** Map the backend user ({id,email,name}) onto the richer client profile. */
function mapUserFromApi(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    avatarInitials: initials(apiUser.name),
    plan: "Free", // backend has no billing model yet
    title: "",
    location: "",
    bio: "",
    yearsExperience: 0,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // A 401 on an authenticated call means the stored session is dead — drop it
  // so RequireAuth sends the user back to /auth/login. A login attempt carries
  // no token, so a bad-password 401 just surfaces as an error below.
  if (res.status === 401 && token) {
    useAuthStore.getState().logout();
  }
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
    const data = await request<ApiAuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const user = mapUserFromApi(data.user);
    useAuthStore.getState().setSession(data.access_token, user);
    return user;
  },
  async signup(name: string, email: string, password: string): Promise<User> {
    const data = await request<ApiAuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const user = mapUserFromApi(data.user);
    useAuthStore.getState().setSession(data.access_token, user);
    return user;
  },
  async forgotPassword(_email: string): Promise<void> {
    // No backend endpoint yet — the reset flow is frontend-only for now.
    await new Promise((r) => setTimeout(r, 600));
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
      const token = useAuthStore.getState().token;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
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

/* -------------------------------- Interview -------------------------------- */

export interface InterviewStartParams {
  resumeId?: string; // optional — a generic session works without one
  role?: string;
  difficulty?: Difficulty;
  count?: number;
}

export const interviewService = {
  async start(params: InterviewStartParams): Promise<InterviewSession> {
    const raw = await request<ApiInterviewSession>("/interview/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_id: params.resumeId ?? null,
        role: params.role ?? "Software Engineer",
        difficulty: params.difficulty ?? "mid",
        count: params.count ?? 5,
      }),
    });
    const session = mapInterviewSessionFromApi(raw);
    useNotificationStore.getState().push({
      title: "Interview session ready",
      detail: `${session.questions.length} questions for ${session.role} (${session.difficulty})`,
      kind: "interview",
    });
    return session;
  },

  async feedback(
    sessionId: string,
    questionId: string,
    answer: string,
  ): Promise<InterviewFeedback> {
    const raw = await request<ApiInterviewFeedback>("/interview/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, question_id: questionId, answer }),
    });
    return mapInterviewFeedbackFromApi(raw);
  },
};

/* ------------------------------ Career Roadmap ----------------------------- */

export interface RoadmapParams {
  resumeId?: string; // optional — a plan works without one
  targetRole?: string;
  horizon?: number; // weeks
}

export const roadmapService = {
  async generate(params: RoadmapParams): Promise<RoadmapPlan> {
    const raw = await request<ApiRoadmapPlan>("/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_id: params.resumeId ?? null,
        target_role: params.targetRole ?? "Software Engineer",
        horizon: params.horizon ?? 12,
      }),
    });
    const plan = mapRoadmapFromApi(raw);
    useNotificationStore.getState().push({
      title: "Career roadmap ready",
      detail: `${plan.horizon}-week plan to reach ${plan.targetRole}`,
      kind: "roadmap",
    });
    return plan;
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
  interviewService,
  roadmapService,
};
