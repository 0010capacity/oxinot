import { createWithEqualityFn } from "zustand/traditional";
import { persist } from "zustand/middleware";
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
  "sf-pro": '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  roboto: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "open-sans": '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  lato: 'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "source-sans":
    '"Source Sans Pro", -apple-system, BlinkMacSystemFont, sans-serif',
  "noto-sans": '"Noto Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  "ibm-plex": '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  "jetbrains-mono": '"JetBrains Mono", monospace',
  "fira-code": '"Fira Code", monospace',
  cascadia: '"Cascadia Code", monospace',
};

export const useThemeStore = createWithEqualityFn<ThemeState>()(
  persist(
    (set, get) => ({
      colorVariant: "default",
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
    },
  ),
);

export type { ColorVariant };
