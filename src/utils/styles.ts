/**
 * Style utility functions
 * Provides helpers for conditional styling, theme-aware values, and style merging
 */

import type React from "react";

/**
 * Helper to conditionally apply values based on theme
 * @param light - Value to use in light theme
 * @param dark - Value to use in dark theme
 * @param isDark - Whether dark theme is active
 * @returns The appropriate value for the current theme
 */
export function getThemeValue<T>(light: T, dark: T, isDark: boolean): T {
  return isDark ? dark : light;
}

/**
 * Helper to merge multiple style objects
 * Later styles override earlier ones
 * @param styles - Style objects to merge
 * @returns Merged style object
 */
export function mergeStyles(
  ...styles: (React.CSSProperties | undefined | null | false)[]
): React.CSSProperties {
  return Object.assign(
    {},
    ...styles.filter((style): style is React.CSSProperties => Boolean(style)),
  );
}

/**
 * Helper to create opacity toggle styles
 * @param baseOpacity - Base opacity value
 * @param hoverOpacity - Opacity on hover
 * @returns Object with opacity handlers
 */
export function createOpacityToggle(
  baseOpacity: number | string,
  hoverOpacity: number | string,
) {
  return {
    opacity: baseOpacity,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.opacity = String(hoverOpacity);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.opacity = String(baseOpacity);
    },
  };
}

/**
 * Helper to generate border style
 * @param color - Border color (CSS variable or color value)
 * @param width - Border width
 * @param style - Border style (solid, dashed, etc.)
 * @returns Border style string
 */
export function getBorderStyle(
  color: string,
  width = "1px",
  style = "solid",
): string {
  return `${width} ${style} ${color}`;
}

/**
 * Conditionally join class names
 * @param classes - Class names or conditional class names
 * @returns Joined class name string
 */
export function classNames(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Convert pixel value to number
 * @param value - Pixel value string (e.g., "16px")
 * @returns Number value
 */
export function pxToNumber(value: string): number {
  return Number.parseInt(value.replace("px", ""), 10);
}

/**
 * Convert number to pixel value
 * @param value - Number value
 * @returns Pixel value string (e.g., "16px")
 */
export function numberToPx(value: number): string {
  return `${value}px`;
}

/**
 * Get CSS variable value from document
 * @param variable - CSS variable name (with or without --)
 * @returns CSS variable value
 */
export function getCSSVariable(variable: string): string {
  const varName = variable.startsWith("--") ? variable : `--${variable}`;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

/**
 * Set CSS variable on document
 * @param variable - CSS variable name (with or without --)
 * @param value - Value to set
 */
export function setCSSVariable(variable: string, value: string): void {
  const varName = variable.startsWith("--") ? variable : `--${variable}`;
  document.documentElement.style.setProperty(varName, value);
}
