import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TelemetryState {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      isEnabled: false,
      setEnabled: (enabled: boolean) => {
        set({ isEnabled: enabled });
      },
    }),
    {
      name: "telemetry-store",
      version: 1,
    },
  ),
);
