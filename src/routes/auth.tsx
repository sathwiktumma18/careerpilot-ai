import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  // Parent auth route: keep this route present for the file-based
  // routing hierarchy but do not redirect unconditionally. Redirects
  // to individual auth pages are handled by explicit links or the
  // index route. Avoiding a forced redirect here prevents an SSR
  // redirect loop when rendering child routes like `/auth/login`.
});
