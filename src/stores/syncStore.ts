import { createWithEqualityFn } from "zustand/traditional";

interface SyncState {
  isReindexing: boolean;
  progress: number; // 0-100
  message: string;
  startReindex: () => void;
  updateProgress: (progress: number, message?: string) => void;
  finishReindex: () => void;
  cancelReindex: () => void;
}

export const useSyncStore = createWithEqualityFn<SyncState>()((set) => ({
  isReindexing: false,
  progress: 0,
  message: "",
  startReindex: () => {
    set({ isReindexing: true, progress: 0, message: "Starting reindex..." });
  },
  updateProgress: (progress: number, message?: string) => {
    set((state) => ({
      progress: Math.min(100, Math.max(0, progress)),
      message: message || state.message,
    }));
  },
  finishReindex: () => {
    set({ isReindexing: false, progress: 100, message: "Reindex complete!" });
  },
  cancelReindex: () => {
    set({ isReindexing: false, progress: 0, message: "Reindex cancelled" });
  },
}));
