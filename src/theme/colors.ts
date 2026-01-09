import type { ColorPalette } from "./types";

// Define base color palettes for each variant
export const COLOR_VARIANTS = {
  default: {
    accent: "#6366f1",
    accentHover: "#818cf8",
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
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "0, 0, 0";
}

// Generate color palettes for dark and light schemes
export function createColorPalette(
  scheme: "dark" | "light",
  variant: keyof typeof COLOR_VARIANTS,
): ColorPalette {
  const variantColors = COLOR_VARIANTS[variant];

  if (scheme === "dark") {
    return {
      bg: {
        primary: "#1a1a1a",
        secondary: "#1a1b1e",
        tertiary: "#0b0c0f",
        elevated: "#252525",
      },
      text: {
        primary: "#e0e0e0",
        secondary: "#c1c2c5",
        tertiary: "#909296",
        link: variantColors.accentHover,
      },
      border: {
        primary: "rgba(255, 255, 255, 0.1)",
        secondary: "rgba(255, 255, 255, 0.06)",
        focus: variantColors.accent,
      },
      interactive: {
        hover: "rgba(255, 255, 255, 0.08)",
        active: "rgba(255, 255, 255, 0.12)",
        selected: `rgba(${hexToRgb(variantColors.accent)}, 0.15)`,
        focus: `rgba(${hexToRgb(variantColors.accent)}, 0.3)`,
      },
      accent: variantColors.accent,
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
      bullet: {
        default: "rgba(255, 255, 255, 0.4)",
        hover: "rgba(255, 255, 255, 0.7)",
        active: "rgba(255, 255, 255, 0.85)",
      },
      indentGuide: "rgba(255, 255, 255, 0.06)",
    };
  }

  return {
    bg: {
      primary: "#ffffff",
      secondary: "#f8f9fa",
      tertiary: "#f1f3f5",
      elevated: "#ffffff",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#495057",
      tertiary: "#868e96",
      link: variantColors.accent,
    },
    border: {
      primary: "rgba(0, 0, 0, 0.1)",
      secondary: "rgba(0, 0, 0, 0.06)",
      focus: variantColors.accent,
    },
    interactive: {
      hover: "rgba(0, 0, 0, 0.05)",
      active: "rgba(0, 0, 0, 0.08)",
      selected: `rgba(${hexToRgb(variantColors.accent)}, 0.1)`,
      focus: `rgba(${hexToRgb(variantColors.accent)}, 0.2)`,
    },
    accent: variantColors.accent,
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    bullet: {
      default: "rgba(0, 0, 0, 0.4)",
      hover: "rgba(0, 0, 0, 0.7)",
      active: "rgba(0, 0, 0, 0.85)",
    },
    indentGuide: "rgba(0, 0, 0, 0.06)",
  };
}
