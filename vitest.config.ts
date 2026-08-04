import path from "path";
import { defineConfig } from "vitest/config";

// Standalone vitest config (no Vite app plugins — those would drag in
// TanStack Start / Nitro during unit tests).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
