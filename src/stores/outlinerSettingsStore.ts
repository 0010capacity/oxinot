import { persist } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

export type FontFamily =
  | "Inter"
  | "System"
  | "SF Pro"
  | "Helvetica Neue"
  | "Arial"
  | "Georgia"
  | "Times New Roman"
  | "Noto Sans"
  | "Roboto"
  | "Open Sans"
  | "Lato"
  | "Montserrat";

export const FONT_OPTIONS: {
  label: string;
  value: FontFamily;
  stack: string;
}[] = [
  {
    label: "Inter (Default)",
    value: "Inter",
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    label: "System Default",
    value: "System",
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  {
    label: "SF Pro (Apple)",
    value: "SF Pro",
    stack: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    label: "Helvetica Neue",
    value: "Helvetica Neue",
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    label: "Arial",
    value: "Arial",
    stack: "Arial, Helvetica, sans-serif",
  },
  {
    label: "Georgia (Serif)",
    value: "Georgia",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    label: "Times New Roman (Serif)",
    value: "Times New Roman",
    stack: "'Times New Roman', Times, serif",
  },
  {
    label: "Noto Sans",
    value: "Noto Sans",
    stack: "'Noto Sans', sans-serif",
  },
  {
    label: "Roboto",
    value: "Roboto",
    stack: "Roboto, sans-serif",
  },
  {
    label: "Open Sans",
    value: "Open Sans",
    stack: "'Open Sans', sans-serif",
  },
  {
    label: "Lato",
    value: "Lato",
    stack: "Lato, sans-serif",
  },
  {
    label: "Montserrat",
    value: "Montserrat",
    stack: "Montserrat, sans-serif",
  },
];

interface OutlinerSettings {
  showIndentGuides: boolean;
  fontFamily: FontFamily;
  autoExpandBlocks: boolean;
  showBlockCount: boolean;
  showCodeBlockLineNumbers: boolean;
  enableCodeSyntaxHighlighting: boolean;
  indentSize: number;
}

interface OutlinerSettingsStore extends OutlinerSettings {
  toggleIndentGuides: () => void;
  setShowIndentGuides: (value: boolean) => void;
  setFontFamily: (font: FontFamily) => void;
  getFontStack: () => string;
  setAutoExpandBlocks: (value: boolean) => void;
  setShowBlockCount: (value: boolean) => void;
  setShowCodeBlockLineNumbers: (value: boolean) => void;
  setEnableCodeSyntaxHighlighting: (value: boolean) => void;
  setIndentSize: (size: number) => void;
}

export const useOutlinerSettingsStore =
  createWithEqualityFn<OutlinerSettingsStore>()(
    persist(
      (set, get) => ({
        // Default settings
        showIndentGuides: true,
        fontFamily: "Inter",
        autoExpandBlocks: true,
        showBlockCount: false,
        showCodeBlockLineNumbers: true,
        enableCodeSyntaxHighlighting: true,
        indentSize: 24,

        // Actions
        toggleIndentGuides: () =>
          set((state) => ({ showIndentGuides: !state.showIndentGuides })),

        setShowIndentGuides: (value: boolean) =>
          set({ showIndentGuides: value }),

        setAutoExpandBlocks: (value: boolean) =>
          set({ autoExpandBlocks: value }),

        setShowBlockCount: (value: boolean) => set({ showBlockCount: value }),

        setShowCodeBlockLineNumbers: (value: boolean) =>
          set({ showCodeBlockLineNumbers: value }),

        setEnableCodeSyntaxHighlighting: (value: boolean) =>
          set({ enableCodeSyntaxHighlighting: value }),

        setIndentSize: (size: number) => set({ indentSize: size }),

        setFontFamily: (font: FontFamily) => {
          set({ fontFamily: font });
          // Update CSS variable
          const fontOption = FONT_OPTIONS.find((opt) => opt.value === font);
          if (fontOption) {
            document.documentElement.style.setProperty(
              "--font-family",
              fontOption.stack,
            );
          }
        },

        getFontStack: () => {
          const fontFamily = get().fontFamily;
          const fontOption = FONT_OPTIONS.find(
            (opt) => opt.value === fontFamily,
          );
          return fontOption?.stack || FONT_OPTIONS[0].stack;
        },
      }),
      {
        name: "outliner-settings",
      },
    ),
    shallow,
  );
