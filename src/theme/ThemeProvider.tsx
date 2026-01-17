import { useComputedColorScheme, MantineProvider } from "@mantine/core";
import { type ReactNode, createContext, useEffect, useMemo, useCallback } from "react";
import type { AppTheme } from "./schema"; // Import AppTheme
import { themeRegistry } from "./themes"; // Import themeRegistry
import type { MantineThemeOverride } from "@mantine/core";

export const ThemeContext = createContext<AppTheme | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// Inner provider that uses Mantine hooks
function ThemeProviderInner({ children }: ThemeProviderProps) {
  const computedColorScheme = useComputedColorScheme("light");

  const theme: AppTheme = useMemo(() => {
    // For now, we'll just pick 'light' or 'dark' from the registry.
    // Future work: map colorVariant to specific named themes in the registry.
    const selectedThemeName = computedColorScheme === "dark" ? "dark" : "light";
    return themeRegistry[selectedThemeName] || themeRegistry.light; // Fallback to light
  }, [computedColorScheme]); // Removed colorVariant from dependencies

  const mantineTheme: MantineThemeOverride = useMemo(
    () => ({
      primaryColor: "indigo", // Mantine's primaryColor usually refers to a palette name
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
      fontFamily: theme.typography.fontFamily,
    }),
    [theme.colors.accent, theme.typography.fontFamily]
  );

  const camelToKebab = useCallback((str: string): string => {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }, []);

  // Apply ALL CSS variables dynamically on every theme change
  useEffect(() => {
    const root = document.documentElement;

    // Helper to recursively set CSS variables
    const setCssVariables = (
      element: HTMLElement,
      prefix: string,
      obj: Record<string, unknown>, // Changed 'any' to 'unknown'
    ) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          const cssVarName = `--${prefix}-${camelToKebab(key)}`;

          if (typeof value === "object" && value !== null) {
            setCssVariables(element, cssVarName, value as Record<string, unknown>);
          } else {
            // Handle specific cases where units might be missing (e.g., indentSize from layout)
            let cssValue = value;
            if (key === 'indentSize' && typeof value === 'number') {
              cssValue = `${value}px`;
            }
            element.style.setProperty(cssVarName, String(cssValue));
          }
        }
      }
    };

    // Apply colors
    setCssVariables(root, "color", theme.colors);

    // Apply spacing
    setCssVariables(root, "spacing", theme.spacing);

    // Apply typography
    root.style.setProperty("--font-family", theme.typography.fontFamily);
    root.style.setProperty("--font-family-mono", theme.typography.monoFontFamily);
    setCssVariables(root, "font-size", theme.typography.fontSize);
    setCssVariables(root, "line-height", theme.typography.lineHeight);

    // Apply radius
    setCssVariables(root, "radius", theme.radius);

    // Apply layout
    setCssVariables(root, "layout", theme.layout);

    // Apply transitions
    setCssVariables(root, "transition", theme.transitions);

    // Apply opacity
    setCssVariables(root, "opacity", theme.opacity);

    // TODO: Apply shadows if they are part of AppTheme
  }, [theme, camelToKebab]); // Added camelToKebab to dependencies


  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </MantineProvider>
  );
}

// Outer provider that wraps with initial MantineProvider for hooks
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MantineProvider defaultColorScheme="auto">
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </MantineProvider>
  );
}