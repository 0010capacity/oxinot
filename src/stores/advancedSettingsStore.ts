import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdvancedSettings {
  autoUpdate: boolean;
  checkUpdatesOnStartup: boolean;
  betaUpdates: boolean;
  telemetryEnabled: boolean;
}

interface AdvancedSettingsStore extends AdvancedSettings {
  setAutoUpdate: (value: boolean) => void;
  setCheckUpdatesOnStartup: (value: boolean) => void;
  setBetaUpdates: (value: boolean) => void;
  setTelemetryEnabled: (value: boolean) => void;
  resetAllSettings: () => void;
}

const defaultSettings: AdvancedSettings = {
  autoUpdate: true,
  checkUpdatesOnStartup: true,
  betaUpdates: false,
  telemetryEnabled: false,
};

export const useAdvancedSettingsStore = create<AdvancedSettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setAutoUpdate: (value: boolean) => set({ autoUpdate: value }),
      setCheckUpdatesOnStartup: (value: boolean) =>
        set({ checkUpdatesOnStartup: value }),
      setBetaUpdates: (value: boolean) => set({ betaUpdates: value }),
      setTelemetryEnabled: (value: boolean) => set({ telemetryEnabled: value }),

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
    }),
    {
      name: "advanced-settings",
    },
  ),
);
