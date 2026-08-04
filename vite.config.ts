import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

/**
 * Native Vite config for CareerPilot AI (TanStack Start).
 * Replaces the former Lovable-managed config with the same behavior:
 * React + Tailwind + TanStack Start, Lightning CSS in dev so the preview
 * matches the build, Cloudflare Workers as the deploy target, and
 * server-import protection.
 */
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    // API calls go cross-origin to the FastAPI backend in development via
    // VITE_API_URL (see .env.development). Vite's server.proxy does NOT work
    // here because TanStack Start's dev handler intercepts /api first — so the
    // frontend talks to http://127.0.0.1:8000 directly and CORS handles it.
  },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // SSR error wrapper (src/server.ts) is the bundled server entry.
      server: { entry: "server" },
    }),
    nitro({ defaultPreset: "cloudflare-module" }),
    viteReact(),
    tailwindcss(),
  ],
});
