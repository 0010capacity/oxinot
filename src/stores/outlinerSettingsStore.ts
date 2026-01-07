import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OutlinerSettings {
  showIndentGuides: boolean;
}

interface OutlinerSettingsStore extends OutlinerSettings {
  toggleIndentGuides: () => void;
  setShowIndentGuides: (value: boolean) => void;
}

export const useOutlinerSettingsStore = create<OutlinerSettingsStore>()(
  persist(
    (set) => ({
      // Default settings
      showIndentGuides: true,

      // Actions
      toggleIndentGuides: () =>
        set((state) => ({ showIndentGuides: !state.showIndentGuides })),

      setShowIndentGuides: (value: boolean) =>
        set({ showIndentGuides: value }),
    }),
    {
      name: "outliner-settings",
    },
  ),
);
