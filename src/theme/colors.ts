import type { ColorPalette } from "./types";

// Define base color palettes for each variant
export const COLOR_VARIANTS = {
  indigo: {
    accent: "#7c3aed",
    accentHover: "#8b9dff",
  },
  blue: {
    accent: "#3b82f6",
    accentHover: "#60a5fa",
  },
  purple: {
    accent: "#a855f7",
    accentHover: "#c084fc",
  },
  green: {
    accent: "#10b981",
    accentHover: "#34d399",
  },
  amber: {
    accent: "#f59e0b",
    accentHover: "#fbbf24",
  },
} as const;

// Helper function to convert hex to RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${Number.parseInt(result[1], 16)}, ${Number.parseInt(
        result[2],
        16
      )}, ${Number.parseInt(result[3], 16)}`
    : "0, 0, 0";
}

// Generate color palettes for dark and light schemes
export function createColorPalette(
  scheme: "dark" | "light",
  variant: keyof typeof COLOR_VARIANTS
): ColorPalette {
  // Fallback to blue if invalid variant
  const validVariant = variant in COLOR_VARIANTS ? variant : ("blue" as const);
  const variantColors = COLOR_VARIANTS[validVariant];

  if (!variantColors) {
    throw new Error(
      `Invalid color variant: ${String(variant)}. Must be one of: ${Object.keys(
        COLOR_VARIANTS
      ).join(", ")}`
    );
  }

  if (scheme === "dark") {
    return {
      bg: {
        primary: "#0f0f0f",
        secondary: "#1a1a1d",
        tertiary: "#3a3a42",
        elevated: "#2a2a30",
        overlay: "rgba(0, 0, 0, 0.6)",
      },
      text: {
        primary: "#f0f0f2",
        secondary: "#d4d4d8",
        tertiary: "#a1a1a6",
        link: variantColors.accentHover,
      },
      border: {
        primary: "rgba(255, 255, 255, 0.12)",
        secondary: "rgba(255, 255, 255, 0.08)",
        focus: variantColors.accent,
      },
      interactive: {
        hover: "rgba(255, 255, 255, 0.1)",
        active: "rgba(255, 255, 255, 0.15)",
        selected: `rgba(${hexToRgb(variantColors.accent)}, 0.2)`,
        focus: `rgba(${hexToRgb(variantColors.accent)}, 0.3)`,
      },
      accent: variantColors.accent,
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ff6b6b",
      bullet: {
        default: "rgba(255, 255, 255, 0.4)",
        hover: "rgba(255, 255, 255, 0.7)",
        active: "rgba(255, 255, 255, 1)",
      },
      indentGuide: "rgba(255, 255, 255, 0.08)",
      graph: {
        nodePage: "#ffffff",
        nodeBlock: "#e0e0e0",
      },
    };
  }

  return {
    bg: {
      primary: "#ffffff",
      secondary: "#f9f9fb",
      tertiary: "#f5f5f8",
      elevated: "#efefef",
      overlay: "rgba(0, 0, 0, 0.6)",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#3a3a3a",
      tertiary: "#7a7a7e",
      link: variantColors.accent,
    },
    border: {
      primary: "rgba(0, 0, 0, 0.08)",
      secondary: "rgba(0, 0, 0, 0.05)",
      focus: variantColors.accent,
    },
    interactive: {
      hover: "rgba(0, 0, 0, 0.04)",
      active: "rgba(0, 0, 0, 0.08)",
      selected: `rgba(${hexToRgb(variantColors.accent)}, 0.12)`,
      focus: `rgba(${hexToRgb(variantColors.accent)}, 0.2)`,
    },
    accent: variantColors.accent,
    success: "#059669",
    warning: "#d97706",
    error: "#dc2626",
    bullet: {
      default: "rgba(0, 0, 0, 0.25)",
      hover: "rgba(0, 0, 0, 0.55)",
      active: "rgba(0, 0, 0, 0.8)",
    },
    indentGuide: "rgba(0, 0, 0, 0.06)",
    graph: {
      nodePage: "#000000",
      nodeBlock: "#333333",
    },
  };
}
