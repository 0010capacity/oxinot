import type { AppTheme } from "./schema";
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  LAYOUT,
  TRANSITIONS,
  OPACITY,
  Z_INDEX,
} from "./tokens";
import { createColorPalette } from "./colors"; // Assuming this helps generate ColorPalette

// Helper to create a complete AppTheme from a color scheme
export const createTheme = (
  scheme: "light" | "dark",
  variant: "indigo" | "blue" | "purple" | "green" | "amber" = "blue"
): AppTheme => {
  const colors = createColorPalette(scheme, variant);
  return {
    name: `${scheme}-${variant}`,
    scheme,
    variant,
    colors,
    spacing: SPACING,
    typography: TYPOGRAPHY,
    radius: RADIUS,
    layout: LAYOUT,
    transitions: TRANSITIONS,
    opacity: OPACITY,
    zIndex: Z_INDEX,
  };
};

export const lightTheme: AppTheme = createTheme("light");
export const darkTheme: AppTheme = createTheme("dark");

export const themeRegistry: Record<string, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
