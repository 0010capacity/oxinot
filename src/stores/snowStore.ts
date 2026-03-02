import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SnowStore {
  isSnowEnabled: boolean;
  toggleSnow: () => void;
  setSnowEnabled: (enabled: boolean) => void;
}

export const useSnowStore = create<SnowStore>()(
  persist(
    (set) => ({
      isSnowEnabled: false,
      toggleSnow: () =>
        set((state) => ({ isSnowEnabled: !state.isSnowEnabled })),
      setSnowEnabled: (enabled: boolean) => set({ isSnowEnabled: enabled }),
    }),
    {
      name: "oxinot-snow-enabled",
    },
  ),
);
