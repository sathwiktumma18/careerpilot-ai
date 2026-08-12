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
  type ResumeVersionLite,
  type Settings,
  type User,
  type UserRole,
  type NotificationItem,
} from "@/lib/store";
import type { Analysis } from "@/lib/analysis";
import { emptyAnalysis } from "@/lib/analysis";
import { mapAnalysisFromApi, type ApiAnalysis } from "@/lib/analysis-mapper";
import {
  mapJobLiteFromApi,
  mapJobMatchFromApi,
  mapLiveJobSearchFromApi,
  type ApiJobLite,
  type ApiJobMatchResponse,
  type ApiLiveJobSearchResponse,
} from "@/lib/job-match-mapper";
import type { JobLite, JobMatchResponse, LiveJobSearchResponse } from "@/lib/job-match";
import {
  mapInterviewFeedbackFromApi,
  mapInterviewSessionFromApi,
  type ApiInterviewFeedback,
  type ApiInterviewSession,
} from "@/lib/interview-mapper";
import type { Difficulty, InterviewFeedback, InterviewSession } from "@/lib/interview";
import { mapRoadmapFromApi, type ApiRoadmapPlan } from "@/lib/roadmap-mapper";
import type { RoadmapPlan } from "@/lib/roadmap";
import {
  mapPortfolioFromApi,
  type ApiMyPortfolio,
  type ApiPortfolio,
} from "@/lib/portfolio-mapper";
import type { PortfolioProfile } from "@/lib/portfolio";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/** The backend's auth payload — the subset of the user we keep client-side. */
interface ApiUser {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
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

/** Map the backend user ({id,email,name,role}) onto the richer client profile. */
function mapUserFromApi(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    avatarInitials: initials(apiUser.name),
    role: apiUser.role ?? "job_seeker",
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
  title: string;
  file_name: string;
  status: string;
  ats_score: number | null;
  created_at: string;
  version_count: number;
  view_count: number;
  last_viewed_at: string | null;
  first_ats: number | null;
}

interface ApiVersionInfo {
  version_no: number;
  file_name: string;
  status: string;
  ats_score: number | null;
  created_at: string;
  analyzed_at: string | null;
}

interface ApiResumeDetail extends ApiResumeListItem {
  current_version_no: number;
  versions: ApiVersionInfo[];
  analysis: ApiAnalysis | null;
}

function mapVersionFromApi(v: ApiVersionInfo): ResumeVersionLite {
  return {
    versionNo: v.version_no,
    fileName: v.file_name,
    status: v.status,
    atsScore: v.ats_score,
    createdAt: v.created_at,
    analyzedAt: v.analyzed_at,
  };
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
  async signup(
    name: string,
    email: string,
    password: string,
    role: UserRole = "job_seeker",
  ): Promise<User> {
    const data = await request<ApiAuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const user = mapUserFromApi(data.user);
    useAuthStore.getState().setSession(data.access_token, user);
    return user;
  },
  async forgotPassword(email: string): Promise<string | null> {
    // Returns the one-time reset token when the email has an account, else null.
    // The demo surfaces the token in the response instead of emailing it.
    const data = await request<{ reset_token: string | null }>("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return data.reset_token;
  },
  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    await request<{ detail: string }>("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, new_password: newPassword }),
    });
  },
  /**
   * Start social sign-in. Returns `null` when the provider isn't configured on
   * the server (the UI keeps the button in "coming soon" mode). Otherwise the
   * caller redirects the whole page to `url`.
   */
  async oauthStart(provider: "google" | "github"): Promise<string | null> {
    try {
      const data = await request<{ url: string }>(`/auth/oauth/${provider}/authorize`);
      return data.url;
    } catch {
      return null; // 501 = not configured
    }
  },
  /** Turn an OAuth callback token into a session (GET /auth/me with it). */
  async completeOAuth(token: string): Promise<User> {
    const data = await request<ApiUser>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = mapUserFromApi(data);
    useAuthStore.getState().setSession(token, user);
    return user;
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
            // Put the new resume in the store immediately, so a follow-up
            // analyze() can find it. Without this, updateResumeAnalysis() is a
            // no-op and analyze() throws "Resume not found after analysis".
            useResumeStore.getState().upsert({
              id: data.id,
              title: data.file_name,
              fileName: data.file_name,
              sizeKb: Math.round(file.size / 1024),
              uploadedAt: new Date().toISOString(),
              analysis: emptyAnalysis(data.id, data.file_name),
              versions: [],
              versionCount: 1,
              viewCount: 0,
              firstAts: null,
            });
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

  async analyze(
    id: string,
    opts?: { jobDescription?: string; targetRole?: string },
  ): Promise<ResumeRecord> {
    const jd = opts?.jobDescription || opts?.targetRole;
    const raw = await request<ApiAnalysis>(`/resumes/${id}/analyze`, {
      method: "POST",
      ...(jd
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(opts?.targetRole ? { target_role: opts.targetRole } : {}),
              ...(opts?.jobDescription ? { job_description: opts.jobDescription } : {}),
            }),
          }
        : {}),
    });
    const analysis = mapAnalysisFromApi(raw);
    useResumeStore.getState().updateResumeAnalysis(id, analysis);
    useNotificationStore.getState().push({
      title: jd ? "JD score complete" : "Resume analysis complete",
      detail: `${analysis.fileName} — ATS ${analysis.atsScore}`,
      kind: "resume",
    });
    const record = useResumeStore.getState().getResume(id);
    if (!record) {
      // The upload page adds the record on upload, but analyze() can also be
      // reached with the store empty (e.g. a stale localStorage snapshot).
      // Build the record from the fresh analysis instead of failing the call.
      useResumeStore.getState().upsert({
        id: analysis.id,
        title: analysis.fileName,
        fileName: analysis.fileName,
        sizeKb: 0,
        uploadedAt: analysis.uploadedAt,
        analysis,
        versions: [],
        versionCount: 1,
        viewCount: 0,
        firstAts: analysis.atsScore,
      });
      return useResumeStore.getState().getResume(id)!;
    }
    return record;
  },

  /** Return the stored analysis of a specific version (analyzes on first call). */
  async getVersionAnalysis(id: string, versionNo: number): Promise<Analysis> {
    const raw = await request<ApiAnalysis>(`/resumes/${id}/analyze?version=${versionNo}`, {
      method: "POST",
    });
    return mapAnalysisFromApi(raw);
  },

  async list(): Promise<ResumeRecord[]> {
    const items = await request<ApiResumeListItem[]>("/resumes");
    const store = useResumeStore.getState();
    const records: ResumeRecord[] = items.map((item) => {
      const existing = store.getResume(item.id);
      return {
        id: item.id,
        title: item.title,
        fileName: item.file_name,
        sizeKb: 0,
        uploadedAt: item.created_at,
        analysis: existing?.analysis ?? emptyAnalysis(item.id, item.file_name),
        versions: existing?.versions ?? [],
        versionCount: item.version_count,
        viewCount: item.view_count,
        firstAts: item.first_ats,
      };
    });
    store.hydrate(records);
    return records;
  },

  /** Full detail for a resume — versions + current analysis; increments views. */
  async get(id: string): Promise<ResumeRecord | null> {
    const detail = await request<ApiResumeDetail>(`/resumes/${id}`);
    const store = useResumeStore.getState();
    const existing = store.getResume(id);
    const record: ResumeRecord = {
      id: detail.id,
      title: detail.title,
      fileName: detail.file_name,
      sizeKb: existing?.sizeKb ?? 0,
      uploadedAt: detail.created_at,
      analysis: detail.analysis
        ? mapAnalysisFromApi(detail.analysis)
        : (existing?.analysis ?? emptyAnalysis(detail.id, detail.file_name)),
      versions: detail.versions.map(mapVersionFromApi),
      versionCount: detail.version_count,
      viewCount: detail.view_count,
      firstAts: detail.first_ats,
    };
    store.upsert(record);
    return record;
  },

  /** Upload a new snapshot of an existing resume group. */
  async addVersion(
    id: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<ResumeVersionLite> {
    const form = new FormData();
    form.append("file", file, file.name);

    const data = await new Promise<{
      id: string;
      version_no: number;
      file_name: string;
      status: string;
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/resumes/${id}/versions`);
      const token = useAuthStore.getState().token;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
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

    const version: ResumeVersionLite = {
      versionNo: data.version_no,
      fileName: data.file_name,
      status: data.status,
      atsScore: null,
      createdAt: new Date().toISOString(),
      analyzedAt: null,
    };
    useResumeStore.getState().addVersion(id, version);
    return version;
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
    const totalVersions = resumes.reduce((a, r) => a + r.versionCount, 0);
    const totalViews = resumes.reduce((a, r) => a + r.viewCount, 0);
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
          label: "Versions Created",
          value: String(totalVersions),
          delta: totalVersions ? `${totalVersions} snapshot${totalVersions > 1 ? "s" : ""}` : "—",
          trend: "up" as const,
        },
        {
          label: "Total Views",
          value: String(totalViews),
          delta: totalViews ? "across all resumes" : "—",
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

  /** Live postings from JSearch — India-first, ≤4 weeks old. Graceful: the
   *  response carries `available: false` when the key is missing / rate-limited,
   *  and the UI then shows a fallback note instead of an error. */
  async searchLiveJobs(params: {
    query: string;
    location?: string;
    remoteOnly?: boolean;
    limit?: number;
  }): Promise<LiveJobSearchResponse> {
    const qs = new URLSearchParams({
      query: params.query,
      location: params.location ?? "",
      remote_only: String(params.remoteOnly ?? false),
      limit: String(params.limit ?? 10),
    });
    const raw = await request<ApiLiveJobSearchResponse>(`/jobs/search?${qs.toString()}`);
    return mapLiveJobSearchFromApi(raw);
  },
};

/* ------------------------------- Messaging -------------------------------- */

export interface ApiMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read: boolean;
}

export interface ApiConversationLite {
  id: string;
  other_user_id: string;
  other_name: string;
  other_role: string;
  other_headline: string;
  preview: string;
  last_message_at: string;
  unread_count: number;
}

export interface ApiConversationDetail {
  id: string;
  seeker_id: string;
  recruiter_id: string;
  seeker_name: string;
  recruiter_name: string;
  seeker_role: string;
  recruiter_role: string;
  messages: ApiMessage[];
  unread_count: number;
}

export const messagesService = {
  async list(): Promise<ApiConversationLite[]> {
    return request<ApiConversationLite[]>("/messages");
  },
  /** Open (get-or-create) a thread with another user, returning its detail. */
  async open(userId: string): Promise<ApiConversationDetail> {
    return request<ApiConversationDetail>("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  },
  async get(conversationId: string): Promise<ApiConversationDetail> {
    return request<ApiConversationDetail>(`/messages/${conversationId}`);
  },
  async send(conversationId: string, body: string): Promise<ApiMessage> {
    return request<ApiMessage>(`/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
  },
};

/* ---------------------------- Recruiter data ------------------------------- */

export interface ApiRecruiterLite {
  user_id: string;
  name: string;
  email: string;
  headline: string;
  slug: string;
  path: string;
}

export interface ApiCandidateSummary {
  user_id: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  ats_score: number | null;
  resume_id: string | null;
  resume_title: string | null;
  searched_roles: string[];
  last_active: string | null;
  analyzed_count: number;
  search_count: number;
}

export interface ApiCandidateDetail extends ApiCandidateSummary {
  summary: string;
  skills: string[];
  conversation_id: string | null;
}

export const recruiterService = {
  /** The recruiter directory — job seekers use it to find + message recruiters. */
  async listRecruiters(): Promise<ApiRecruiterLite[]> {
    return request<ApiRecruiterLite[]>("/recruiters");
  },
  /** The real recruiter dashboard — active job seekers, newest-active first. */
  async candidates(): Promise<ApiCandidateSummary[]> {
    return request<ApiCandidateSummary[]>("/recruiter/candidates");
  },
  async candidate(userId: string): Promise<ApiCandidateDetail> {
    return request<ApiCandidateDetail>(`/recruiter/candidates/${userId}`);
  },
};

/* -------------------------------- Portfolio -------------------------------- */

export const portfolioService = {
  /** Fetch a public portfolio by slug — no auth required (shareable page). */
  async getPublic(slug: string): Promise<PortfolioProfile> {
    const raw = await request<ApiPortfolio>(`/public/portfolio/${slug}`);
    return mapPortfolioFromApi(raw);
  },
  /** The current user's public path (slug + /p/...). */
  async getMe(): Promise<ApiMyPortfolio> {
    return request<ApiMyPortfolio>("/portfolio/me");
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
  portfolioService,
  messagesService,
  recruiterService,
};
