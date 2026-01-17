import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import type { ColorVariant } from "../theme/types";

export type FontFamily =
  | "system"
  | "inter"
  | "sf-pro"
  | "roboto"
  | "open-sans"
  | "lato"
  | "source-sans"
  | "noto-sans"
  | "ibm-plex"
  | "jetbrains-mono"
  | "fira-code"
  | "cascadia";

interface ThemeState {
  colorVariant: ColorVariant;
  setColorVariant: (variant: ColorVariant) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  getFontStack: () => string;
  editorFontSize: number;
  setEditorFontSize: (size: number) => void;
  editorLineHeight: number;
  setEditorLineHeight: (height: number) => void;
}

const fontStacks: Record<FontFamily, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "sf-pro": '"SF Pro Display", -apple-system, BlinkMacMacFont, sans-serif',
  roboto: 'Roboto, -apple-system, BlinkMacMacFont, "Segoe UI", sans-serif',
  "open-sans": '"Open Sans", -apple-system, BlinkMacMacFont, sans-serif',
  lato: 'Lato, -apple-system, BlinkMacMacFont, "Segoe UI", sans-serif',
  "source-sans":
    '"Source Sans Pro", -apple-system, BlinkMacMacFont, sans-serif',
  "noto-sans": '"Noto Sans", -apple-system, BlinkMacMacFont, sans-serif',
  "ibm-plex": '"IBM Plex Sans", -apple-system, BlinkMacMacFont, sans-serif',
  "jetbrains-mono": '"JetBrains Mono", monospace',
  "fira-code": '"Fira Code", monospace',
  cascadia: '"Cascadia Code", monospace',
};

export const useThemeStore = createWithEqualityFn<ThemeState>()(
  persist(
    (set, get) => ({
      colorVariant: "indigo",
      setColorVariant: (variant) => set({ colorVariant: variant }),
      fontFamily: "system",
      setFontFamily: (font) => set({ fontFamily: font }),
      getFontStack: () => fontStacks[get().fontFamily],
      editorFontSize: 16,
      setEditorFontSize: (size) => set({ editorFontSize: size }),
      editorLineHeight: 1.6,
      setEditorLineHeight: (height) => set({ editorLineHeight: height }),
    }),
    {
      name: "theme-settings",
      version: 1, // Increment version when schema changes
      migrate: (persistedState: any, version) => {
        if (version === 0) {
          // If the old state had 'colorVariant: "default"', update it to 'indigo'
          if (persistedState && persistedState.colorVariant === "default") {
            persistedState.colorVariant = "indigo";
          }
        }
        return persistedState;
      },
    },
  ),
);

export type { ColorVariant };