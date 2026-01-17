import { useComputedColorScheme, MantineProvider } from "@mantine/core";
import { type ReactNode, createContext, useEffect, useMemo } from "react";
import { useThemeStore } from "../stores/themeStore";
import { createColorPalette } from "./colors";
import {
  LAYOUT,
  OPACITY,
  RADIUS,
  SPACING,
  TRANSITIONS,
  TYPOGRAPHY,
} from "./tokens";
import type { ColorScheme, Theme } from "./types";
import type { MantineThemeOverride } from "@mantine/core";

export const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// Inner provider that uses Mantine hooks
function ThemeProviderInner({ children }: ThemeProviderProps) {
  const computedColorScheme = useComputedColorScheme("light");
  const colorVariant = useThemeStore((state) => state.colorVariant);

  const theme: Theme = useMemo(
    () => ({
      scheme: computedColorScheme as ColorScheme,
      variant: colorVariant,
      colors: createColorPalette(
        computedColorScheme as ColorScheme,
        colorVariant
      ),
      spacing: SPACING,
      typography: TYPOGRAPHY,
      radius: RADIUS,
    }),
    [computedColorScheme, colorVariant]
  );

  const mantineTheme: MantineThemeOverride = useMemo(
    () => ({
      primaryColor: "indigo",
      colors: {
        indigo: [
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
          theme.colors.accent,
        ],
      },
      fontFamily: TYPOGRAPHY.fontFamily,
    }),
    [theme.colors.accent]
  );

  // Apply CSS variables to root only in dark mode
  // Light mode uses media query in variables.css with !important
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = theme;

    // Only set inline styles for dark mode
    // Light mode variables from media query will take precedence with !important
    if (theme.scheme === "dark") {
      // Background colors
      root.style.setProperty("--color-bg-primary", colors.bg.primary);
      root.style.setProperty("--color-bg-secondary", colors.bg.secondary);
      root.style.setProperty("--color-bg-tertiary", colors.bg.tertiary);
      root.style.setProperty("--color-bg-elevated", colors.bg.elevated);

      // Text colors
      root.style.setProperty("--color-text-primary", colors.text.primary);
      root.style.setProperty("--color-text-secondary", colors.text.secondary);
      root.style.setProperty("--color-text-tertiary", colors.text.tertiary);
      root.style.setProperty("--color-text-link", colors.text.link);

      // Border colors
      root.style.setProperty("--color-border-primary", colors.border.primary);
      root.style.setProperty(
        "--color-border-secondary",
        colors.border.secondary
      );
      root.style.setProperty("--color-border-focus", colors.border.focus);

      // Interactive colors
      root.style.setProperty(
        "--color-interactive-hover",
        colors.interactive.hover
      );
      root.style.setProperty(
        "--color-interactive-active",
        colors.interactive.active
      );
      root.style.setProperty(
        "--color-interactive-selected",
        colors.interactive.selected
      );
      root.style.setProperty(
        "--color-interactive-focus",
        colors.interactive.focus
      );

      // Semantic colors
      root.style.setProperty("--color-accent", colors.accent);
      root.style.setProperty("--color-success", colors.success);
      root.style.setProperty("--color-warning", colors.warning);
      root.style.setProperty("--color-error", colors.error);

      // Component-specific
      root.style.setProperty("--color-bullet-default", colors.bullet.default);
      root.style.setProperty("--color-bullet-hover", colors.bullet.hover);
      root.style.setProperty("--color-bullet-active", colors.bullet.active);
      root.style.setProperty("--color-indent-guide", colors.indentGuide);
    }

    // Spacing
    for (const [key, value] of Object.entries(SPACING)) {
      root.style.setProperty(`--spacing-${key}`, value);
    }

    // Typography
    root.style.setProperty("--font-family", TYPOGRAPHY.fontFamily);
    root.style.setProperty("--font-family-mono", TYPOGRAPHY.monoFontFamily);
    for (const [key, value] of Object.entries(TYPOGRAPHY.fontSize)) {
      root.style.setProperty(`--font-size-${key}`, value);
    }
    for (const [key, value] of Object.entries(TYPOGRAPHY.lineHeight)) {
      root.style.setProperty(`--line-height-${key}`, value);
    }

    // Radius
    for (const [key, value] of Object.entries(RADIUS)) {
      root.style.setProperty(`--radius-${key}`, value);
    }

    // Layout
    for (const [key, value] of Object.entries(LAYOUT)) {
      root.style.setProperty(
        `--layout-${camelToKebab(key)}`,
        typeof value === "number" ? `${value}px` : value
      );
    }

    // Transitions
    for (const [key, value] of Object.entries(TRANSITIONS)) {
      root.style.setProperty(`--transition-${key}`, value);
    }

    // Opacity
    for (const [key, value] of Object.entries(OPACITY)) {
      root.style.setProperty(`--opacity-${key}`, value);
    }
  }, [theme]);

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </MantineProvider>
  );
}

// Outer provider that wraps MantineProvider
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MantineProvider defaultColorScheme="auto">
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </MantineProvider>
  );
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
