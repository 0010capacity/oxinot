import {
  MantineProvider,
  useComputedColorScheme,
  type MantineThemeOverride,
} from "@mantine/core";
import {
  type ReactNode,
  createContext,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useThemeStore } from "../stores/themeStore";
import type { AppTheme } from "./schema";
import { createTheme } from "./themes";

export const ThemeContext = createContext<AppTheme | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// This component sits inside MantineProvider to access the color scheme context
// and synchronize it with our custom CSS variables and context.
function ThemeSynchronizer({ children }: { children: ReactNode }) {
  const computedColorScheme = useComputedColorScheme("light");
  const colorVariant = useThemeStore((state) => state.colorVariant ?? "blue");

  // Derive our custom AppTheme based on Mantine's current color scheme
  const appTheme: AppTheme = useMemo(() => {
    // Force "light" or "dark" based on what Mantine computes (which handles 'auto')
    const resolvedColorScheme =
      computedColorScheme === "dark" ? "dark" : "light";
    return createTheme(resolvedColorScheme, colorVariant);
  }, [computedColorScheme, colorVariant]);

  const camelToKebab = useCallback((str: string): string => {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }, []);

  // Synchronize CSS variables to the document root
  useEffect(() => {
    const root = document.documentElement;
    console.log("[ThemeSynchronizer] Applying theme:", appTheme.name);

    const setCssVariables = (
      element: HTMLElement,
      prefix: string,
      obj: Record<string, unknown>
    ) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          // Fix: Ensure we don't double-hyphenate if the prefix already ends in one,
          // though typically prefix is passed without trailing hyphen in recursive calls below.
          // Actually, standard practice: prefix="--color", key="bg" -> "--color-bg"
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

    // We pass the root prefix (e.g., "--color") to the helper.
    // The helper constructs keys like "--color-bg-primary".
    setCssVariables(root, "--color", appTheme.colors);
    setCssVariables(root, "--spacing", appTheme.spacing);
    root.style.setProperty("--font-family", appTheme.typography.fontFamily);
    root.style.setProperty(
      "--font-family-mono",
      appTheme.typography.monoFontFamily
    );
    setCssVariables(root, "--font-size", appTheme.typography.fontSize);
    setCssVariables(root, "--line-height", appTheme.typography.lineHeight);
    setCssVariables(root, "--radius", appTheme.radius);
    setCssVariables(root, "--layout", appTheme.layout);
    setCssVariables(root, "--transition", appTheme.transitions);
    setCssVariables(root, "--opacity", appTheme.opacity);
  }, [appTheme, camelToKebab]);

  return (
    <ThemeContext.Provider value={appTheme}>{children}</ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorVariant = useThemeStore((state) => state.colorVariant ?? "blue");

  // We define the Mantine theme override here.
  // Note: We cannot access the *computed* color scheme here effectively to change
  // the definition of colors inside `mantineTheme` based on mode,
  // because we are outside the provider.
  // However, we can set up the primary color and other static overrides.
  // The actual color values for our custom system are handled by ThemeSynchronizer.
  const mantineTheme: MantineThemeOverride = useMemo(() => {
    // We create a temporary theme object just to grab the accent color for the current variant
    // We assume 'light' as default just to get the color value; the accent color
    // usually doesn't change wildly between modes in this design system,
    // or if it does, we might need a different strategy for Mantine's internal components.
    // Looking at colors.ts, accent is top-level in the variant config, so it's stable.
    const tempTheme = createTheme("light", colorVariant);
    const accentColor = tempTheme.colors.accent;

    return {
      primaryColor: "custom-accent",
      colors: {
        // We override a custom color palette named 'custom-accent'
        // Mantine expects an array of 10 strings. We'll just fill it with our accent.
        "custom-accent": Array(10).fill(accentColor) as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string
        ],
      },
      fontFamily: tempTheme.typography.fontFamily,
    };
  }, [colorVariant]);

  return (
    <MantineProvider defaultColorScheme="auto" theme={mantineTheme}>
      <ThemeSynchronizer>{children}</ThemeSynchronizer>
    </MantineProvider>
  );
}
