import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuthStore, type UserRole } from "@/lib/store";

/**
 * Role gate for route-level scoping. Recruiters are redirected away from
 * job-seeker features (resume / job match / interview / roadmap / recruiter
 * directory) and job seekers away from the recruiter dashboard. The sidebar
 * already hides these links; this catches direct URL access too.
 */
export function RoleGate({
  roles,
  redirectTo = "/dashboard",
  children,
}: {
  roles: UserRole[];
  redirectTo?: string;
  children: ReactNode;
}) {
  const role = useAuthStore((s) => s.user?.role ?? "job_seeker");
  if (!roles.includes(role)) {
    return <Navigate to={redirectTo} />;
  }
  return <>{children}</>;
}
