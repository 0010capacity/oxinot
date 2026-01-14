import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";

interface AdvancedSettings {
  telemetryEnabled: boolean;
}

interface AdvancedSettingsStore extends AdvancedSettings {
  setTelemetryEnabled: (value: boolean) => void;
  resetAllSettings: () => void;
  clearCache: () => void;
}

const defaultSettings: AdvancedSettings = {
  telemetryEnabled: false,
};

export const useAdvancedSettingsStore =
  createWithEqualityFn<AdvancedSettingsStore>()(
    persist(
      (set) => ({
        ...defaultSettings,

        setTelemetryEnabled: (value: boolean) =>
          set({ telemetryEnabled: value }),

        resetAllSettings: () => {
          set(defaultSettings);
          // Clear all other stores
          localStorage.removeItem("theme-settings");
          localStorage.removeItem("app-settings");
          localStorage.removeItem("clock-format-settings");
          localStorage.removeItem("outliner-settings");
          localStorage.removeItem("git-settings");
          localStorage.removeItem("advanced-settings");
          // Reload to apply changes
          window.location.reload();
        },

        clearCache: () => {
          // Clear browser cache and temporary data
          if ("caches" in window) {
            caches.keys().then((names) => {
              for (const name of names) {
                caches.delete(name);
              }
            });
          }
        },
      }),
      {
        name: "advanced-settings",
      },
    ),
  );
