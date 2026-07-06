import { Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/lib/store";
import { LoadingState } from "@/components/common/LoadingState";

/**
 * Client-side auth gate. Redirects to /auth/login when there is no session.
 * Session state is persisted in localStorage via the Zustand `persist` middleware,
 * so we wait one tick to let the store rehydrate before deciding.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Always render the same initial markup on server and client to avoid
  // hydration mismatch. Wait for the client store to rehydrate from
  // localStorage before deciding whether to redirect.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Loading workspace…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" search={{ next: pathname }} />;
  }

  return <>{children}</>;
}
