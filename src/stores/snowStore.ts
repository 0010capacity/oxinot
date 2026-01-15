import { create } from 'zustand';

interface SnowStore {
  isSnowEnabled: boolean;
  toggleSnow: () => void;
  setSnowEnabled: (enabled: boolean) => void;
}

export const useSnowStore = create<SnowStore>((set) => ({
  isSnowEnabled: true,
  toggleSnow: () => set((state) => ({ isSnowEnabled: !state.isSnowEnabled })),
  setSnowEnabled: (enabled: boolean) => set({ isSnowEnabled: enabled }),
}));
