/**
 * Zustand stores for CareerPilot AI.
 * Persisted to localStorage so the demo behaves like a real product across reloads.
 * When the FastAPI backend is wired in, swap `persist` with async services and keep
 * the same store shape so components don't change.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { generateAnalysis, type Analysis } from "./analysis-generator";

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
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  requestPasswordReset: (email: string) => Promise<void>;
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
      async login(email, _password) {
        await new Promise((r) => setTimeout(r, 500));
        const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const user: User = {
          id: crypto.randomUUID(),
          name,
          email,
          avatarInitials: initials(name),
          plan: "Pro",
          title: "Senior Full-Stack Engineer",
          location: "Berlin, DE",
          bio: "Full-stack engineer building the future of career tooling with CareerPilot.",
          yearsExperience: 6,
        };
        set({ user });
        return user;
      },
      async signup(name, email, _password) {
        await new Promise((r) => setTimeout(r, 600));
        const user: User = {
          id: crypto.randomUUID(),
          name,
          email,
          avatarInitials: initials(name),
          plan: "Free",
          title: "Software Engineer",
          location: "",
          bio: "",
          yearsExperience: 0,
        };
        set({ user });
        return user;
      },
      async requestPasswordReset(_email) {
        await new Promise((r) => setTimeout(r, 700));
      },
      logout() {
        set({ user: null });
      },
      updateProfile(patch) {
        set((s) => (s.user ? { user: { ...s.user, ...patch, avatarInitials: patch.name ? initials(patch.name) : s.user.avatarInitials } } : s));
      },
    }),
    { name: "careerpilot.auth", storage: createJSONStorage(() => localStorage) },
  ),
);

/* -------------------------------------------------------------------------- */
/* Resumes                                                                    */
/* -------------------------------------------------------------------------- */

export type ResumeRecord = {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
  analysis: Analysis;
};

type ResumeState = {
  resumes: ResumeRecord[];
  selectedId: string | null;
  addResume: (file: { name: string; size: number }) => ResumeRecord;
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
          fileName: file.name,
          sizeKb: Math.round(file.size / 1024),
          uploadedAt: new Date().toISOString(),
          analysis: generateAnalysis(id, file.name),
        };
        set((s) => ({ resumes: [record, ...s.resumes], selectedId: id }));
        // fire an app notification
        useNotificationStore.getState().push({
          title: "Resume analysis complete",
          detail: `${file.name} — ATS ${record.analysis.atsScore}`,
          kind: "resume",
        });
        return record;
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

export type NotificationKind = "resume" | "match" | "interview" | "system";

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
