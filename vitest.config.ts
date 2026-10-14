import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests (jsdom). Kept apart from vite.config.ts so editing tests
// never restarts the dev server.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
