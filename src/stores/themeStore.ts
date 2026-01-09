import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ColorVariant } from "../theme/types";

interface ThemeState {
  colorVariant: ColorVariant;
  setColorVariant: (variant: ColorVariant) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorVariant: "default",
      setColorVariant: (variant) => set({ colorVariant: variant }),
    }),
    {
      name: "theme-settings",
    },
  ),
);
