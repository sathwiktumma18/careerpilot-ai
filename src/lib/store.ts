/**
 * Zustand stores for CareerPilot AI.
 * Persisted to localStorage so the demo behaves like a real product across reloads.
 * When the FastAPI backend is wired in, swap `persist` with async services and keep
 * the same store shape so components don't change.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { emptyAnalysis, type Analysis } from "./analysis";

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export type User = {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  plan: "Free" | "Pro" | "Enterprise";
  title: string;
  location: string;
  bio: string;
  yearsExperience: number;
};

type AuthState = {
  user: User | null;
  token: string | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession(token, user) {
        set({ token, user });
      },
      logout() {
        set({ user: null, token: null });
      },
      updateProfile(patch) {
        set((s) =>
          s.user
            ? {
                user: {
                  ...s.user,
                  ...patch,
                  avatarInitials: patch.name ? initials(patch.name) : s.user.avatarInitials,
                },
              }
            : s,
        );
      },
    }),
    {
      name: "careerpilot.auth",
      storage: createJSONStorage(() => localStorage),
      // A user persisted before the token existed (or with a cleared token) has
      // no valid session — treat it as logged out rather than letting the UI in
      // with an authentication header it can't produce.
      onRehydrateStorage: () => (state) => {
        if (state?.user && !state?.token) state.logout();
      },
    },
  ),
);

/* -------------------------------------------------------------------------- */
/* Resumes                                                                    */
/* -------------------------------------------------------------------------- */

/** One snapshot of a resume (from the backend's resume_versions). */
export type ResumeVersionLite = {
  versionNo: number;
  fileName: string;
  status: string; // uploaded | analyzed | error
  atsScore: number | null;
  createdAt: string;
  analyzedAt: string | null;
};

export type ResumeRecord = {
  id: string;
  /** Group name — the first upload's file name; stable across versions. */
  title: string;
  /** Current version's file name (what the UI mostly shows). */
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
  /** Analysis of the current version. */
  analysis: Analysis;
  versions: ResumeVersionLite[];
  versionCount: number;
  viewCount: number;
  firstAts: number | null;
};

type ResumeState = {
  resumes: ResumeRecord[];
  selectedId: string | null;
  addResume: (file: { name: string; size: number }) => ResumeRecord;
  updateResumeAnalysis: (id: string, analysis: Analysis) => void;
  addVersion: (id: string, version: ResumeVersionLite) => void;
  /** Replace-or-insert a full record (used when the backend returns detail). */
  upsert: (record: ResumeRecord) => void;
  hydrate: (resumes: ResumeRecord[]) => void;
  removeResume: (id: string) => void;
  selectResume: (id: string) => void;
  getResume: (id: string) => ResumeRecord | undefined;
};

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      resumes: [],
      selectedId: null,
      addResume(file) {
        const id = crypto.randomUUID();
        const record: ResumeRecord = {
          id,
          title: file.name,
          fileName: file.name,
          sizeKb: Math.round(file.size / 1024),
          uploadedAt: new Date().toISOString(),
          analysis: emptyAnalysis(id, file.name),
          versions: [],
          versionCount: 1,
          viewCount: 0,
          firstAts: null,
        };
        set((s) => ({ resumes: [record, ...s.resumes], selectedId: id }));
        return record;
      },
      updateResumeAnalysis(id, analysis) {
        set((s) => ({
          resumes: s.resumes.map((r) =>
            r.id === id
              ? {
                  ...r,
                  analysis,
                  // Keep the picker in sync: the newest version just got scored.
                  versions: r.versions.length
                    ? r.versions.map((v, i) =>
                        i === r.versions.length - 1
                          ? { ...v, atsScore: analysis.atsScore, status: "analyzed" }
                          : v,
                      )
                    : r.versions,
                }
              : r,
          ),
        }));
      },
      addVersion(id, version) {
        set((s) => ({
          resumes: s.resumes.map((r) =>
            r.id === id
              ? {
                  ...r,
                  fileName: version.fileName,
                  versions: [...r.versions, version],
                  versionCount: version.versionNo,
                  // The current version is now unanalyzed until the user re-runs.
                  analysis: emptyAnalysis(id, version.fileName),
                }
              : r,
          ),
        }));
      },
      upsert(record) {
        set((s) => {
          const exists = s.resumes.some((r) => r.id === record.id);
          return {
            resumes: exists
              ? s.resumes.map((r) => (r.id === record.id ? record : r))
              : [record, ...s.resumes],
            selectedId: s.selectedId ?? record.id,
          };
        });
      },
      hydrate(resumes) {
        const current = get().selectedId;
        set({
          resumes,
          selectedId: resumes.some((r) => r.id === current) ? current : null,
        });
      },
      removeResume(id) {
        set((s) => ({
          resumes: s.resumes.filter((r) => r.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
      },
      selectResume(id) {
        set({ selectedId: id });
      },
      getResume(id) {
        return get().resumes.find((r) => r.id === id);
      },
    }),
    { name: "careerpilot.resumes", storage: createJSONStorage(() => localStorage) },
  ),
);

export function useSelectedResume(): ResumeRecord | null {
  return useResumeStore((s) => {
    if (!s.resumes.length) return null;
    return s.resumes.find((r) => r.id === s.selectedId) ?? s.resumes[0];
  });
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export type Settings = {
  workspaceName: string;
  subdomain: string;
  supportEmail: string;
  timezone: string;
  aiModel: "Standard" | "Pro" | "Ultra";
  emailNotifications: boolean;
  weeklyDigest: boolean;
};

const defaultSettings: Settings = {
  workspaceName: "Alex Morgan",
  subdomain: "alex.careerpilot.ai",
  supportEmail: "alex@example.com",
  timezone: "Europe / Berlin",
  aiModel: "Pro",
  emailNotifications: true,
  weeklyDigest: true,
};

type SettingsState = {
  settings: Settings;
  save: (patch: Partial<Settings>) => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      save(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },
      reset() {
        set({ settings: defaultSettings });
      },
    }),
    { name: "careerpilot.settings", storage: createJSONStorage(() => localStorage) },
  ),
);

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export type NotificationKind = "resume" | "match" | "interview" | "roadmap" | "system";

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  kind: NotificationKind;
  createdAt: string;
  unread: boolean;
};

type NotificationState = {
  items: NotificationItem[];
  push: (n: Omit<NotificationItem, "id" | "createdAt" | "unread">) => void;
  markAllRead: () => void;
  clear: () => void;
};

const seedNotifications: NotificationItem[] = [
  {
    id: "seed-1",
    title: "Welcome to CareerPilot AI",
    detail: "Upload your first resume to unlock personalized insights.",
    kind: "system",
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: "seed-2",
    title: "3 new role matches this week",
    detail: "Linear, Vercel, Stripe — 87%+ fit for your profile.",
    kind: "match",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    unread: true,
  },
];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: seedNotifications,
      push(n) {
        set((s) => ({
          items: [
            {
              ...n,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              unread: true,
            },
            ...s.items,
          ].slice(0, 40),
        }));
      },
      markAllRead() {
        set((s) => ({ items: s.items.map((i) => ({ ...i, unread: false })) }));
      },
      clear() {
        set({ items: [] });
      },
    }),
    { name: "careerpilot.notifications", storage: createJSONStorage(() => localStorage) },
  ),
);

export function useUnreadCount(): number {
  return useNotificationStore((s) => s.items.filter((i) => i.unread).length);
}

/* -------------------------------------------------------------------------- */
/* Recruiter shortlist                                                          */
/* -------------------------------------------------------------------------- */

type RecruiterState = {
  shortlistedIds: string[];
  toggleShortlist: (id: string) => void;
  isShortlisted: (id: string) => boolean;
};

export const useRecruiterStore = create<RecruiterState>()(
  persist(
    (set, get) => ({
      shortlistedIds: [],
      toggleShortlist(id) {
        set((s) => ({
          shortlistedIds: s.shortlistedIds.includes(id)
            ? s.shortlistedIds.filter((x) => x !== id)
            : [...s.shortlistedIds, id],
        }));
      },
      isShortlisted(id) {
        return get().shortlistedIds.includes(id);
      },
    }),
    { name: "careerpilot.recruiter", storage: createJSONStorage(() => localStorage) },
  ),
);
