import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Browser tests in e2e/ run with Playwright (npm run test:e2e), not Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
    // Full page-run and results tests render the real experiment and results
    // components; with all files running in parallel, some exceed Vitest's
    // 5 s default on the development machine (Cycle 9 Task 9.4).
    testTimeout: 20_000,
  },
});
