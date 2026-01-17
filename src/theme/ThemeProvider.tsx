import { useComputedColorScheme, MantineProvider } from "@mantine/core";
import {
  type ReactNode,
  createContext,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useThemeStore } from "../stores/themeStore";
import type { AppTheme } from "./schema";
import type { ColorVariant } from "./types";
import { createTheme } from "./themes";
import type { MantineThemeOverride } from "@mantine/core";

export const ThemeContext = createContext<AppTheme | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// Inner provider that uses Mantine hooks
function ThemeProviderInner({ children }: ThemeProviderProps) {
  const computedColorScheme = useComputedColorScheme("light");
  const colorVariant: ColorVariant = useThemeStore(
    (state) => state.colorVariant ?? "blue"
  );

  console.log("[ThemeProvider] State:", { computedColorScheme, colorVariant });

  const theme: AppTheme = useMemo(() => {
    const resolvedColorScheme: "dark" | "light" =
      computedColorScheme || "light";
    console.log("[ThemeProvider] Resolved Scheme:", resolvedColorScheme);
    return createTheme(resolvedColorScheme, colorVariant);
  }, [computedColorScheme, colorVariant]);

  const mantineTheme: MantineThemeOverride = useMemo(
    () => ({
      primaryColor: "cyan",
      colors: {
        cyan: [
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
    [theme]
  );

  const camelToKebab = useCallback((str: string): string => {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }, []);

  useEffect(() => {
    console.log("[ThemeProvider] Effect running for:", theme.name);
    const root = document.documentElement;

    const setCssVariables = (
      element: HTMLElement,
      prefix: string,
      obj: Record<string, unknown>
    ) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          const cssVarName = `${prefix}-${camelToKebab(key)}`;

          if (typeof value === "object" && value !== null) {
            setCssVariables(
              element,
              cssVarName,
              value as Record<string, unknown>
            );
          } else {
            let cssValue = value;
            if (key === "indentSize" && typeof value === "number") {
              cssValue = `${value}px`;
            }
            element.style.setProperty(cssVarName, String(cssValue));
          }
        }
      }
    };

    setCssVariables(root, "--color", theme.colors);
    setCssVariables(root, "--spacing", theme.spacing);
    root.style.setProperty("--font-family", theme.typography.fontFamily);
    root.style.setProperty(
      "--font-family-mono",
      theme.typography.monoFontFamily
    );
    setCssVariables(root, "--font-size", theme.typography.fontSize);
    setCssVariables(root, "--line-height", theme.typography.lineHeight);
    setCssVariables(root, "--radius", theme.radius);
    setCssVariables(root, "--layout", theme.layout);
    setCssVariables(root, "--transition", theme.transitions);
    setCssVariables(root, "--opacity", theme.opacity);
  }, [theme, camelToKebab]);

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </MantineProvider>
  );
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MantineProvider defaultColorScheme="auto">
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </MantineProvider>
  );
}
