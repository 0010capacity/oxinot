import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(() => {
  /**
   * Reliable build-id injection.
   *
   * NOTE:
   * - Overriding `import.meta.env.*` via `define` can be unreliable because Vite
   *   treats env specially. Instead, inject our own global constants.
   * - These are available in both dev and build.
   */
  const buildId =
    process.env.VITE_GIT_SHA ??
    process.env.GIT_SHA ??
    process.env.COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    "unknown";

  const buildTime = process.env.BUILD_TIME ?? new Date().toISOString();

  return {
    plugins: [react()],
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
  };
});
