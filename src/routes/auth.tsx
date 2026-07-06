import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Layout route for /auth/*.
 * IMPORTANT: do NOT put a `beforeLoad` redirect here — a parent route's
 * `beforeLoad` runs for every child match, so redirecting to /auth/login
 * from here would loop forever (ERR_TOO_MANY_REDIRECTS).
 * The bare `/auth` redirect lives in `auth.index.tsx`.
 */
export const Route = createFileRoute("/auth")({
  component: () => <Outlet />,
});
