import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "react-vendor": ["react", "react-dom", "react/jsx-runtime"],

          // Mantine UI library
          "mantine-core": ["@mantine/core", "@mantine/hooks"],

          // Tauri APIs
          "tauri-api": ["@tauri-apps/api"],

          // CodeMirror editor
          codemirror: [
            "@codemirror/state",
            "@codemirror/view",
            "@codemirror/language",
            "@codemirror/commands",
            "@codemirror/lang-markdown",
            "@codemirror/search",
            "@codemirror/autocomplete",
          ],

          // Lezer parser
          lezer: ["@lezer/common", "@lezer/highlight", "@lezer/markdown"],

          // Zustand state management
          zustand: ["zustand", "immer"],

          // Icons
          icons: ["@tabler/icons-react"],

          // Other libraries
          utils: ["uuid", "markdown-it", "react-virtuoso"],

          // DnD Kit
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],

          // D3 visualization
          d3: ["d3"],

          // i18next localization
          i18n: ["i18next", "react-i18next"],
        },
      },
    },
    chunkSizeWarningLimit: 750,
  },
});
