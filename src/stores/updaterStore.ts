import { create } from "zustand";

interface UpdaterStore {
  manualCheckTrigger: number;
  triggerManualCheck: () => void;
}

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  manualCheckTrigger: 0,
  triggerManualCheck: () =>
    set((state) => ({ manualCheckTrigger: state.manualCheckTrigger + 1 })),
}));
