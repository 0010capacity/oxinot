import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(() => {
  // Inject a build-time git sha into import.meta.env.VITE_GIT_SHA
  // Works in dev + build. Falls back to "unknown" if git isn't available.
  const gitSha =
    process.env.VITE_GIT_SHA ??
    process.env.GIT_SHA ??
    process.env.COMMIT_SHA ??
    "unknown";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_GIT_SHA": JSON.stringify(gitSha),
    },
  };
});
