import type { ColorScheme, ColorVariant, ColorPalette, Spacing, Typography, Radius } from './types';

// Define interfaces for Layout, Transitions, and Opacity based on tokens.ts
export interface Layout {
  maxContentWidth: string;
  containerPadding: string;
  containerPaddingMobile: string;
  contentBottomPadding: string;
  titleBarHeight: string;
  bulletSize: string;
  bulletContainerSize: string;
  collapseToggleSize: string;
  indentSize: number;
}

export interface Transitions {
  fast: string;
  normal: string;
  slow: string;
}

export interface Opacity {
  disabled: string;
  dimmed: string;
  hover: string;
  active: string;
}

export interface AppTheme {
  name: string;
  scheme: ColorScheme;
  variant: ColorVariant;
  colors: ColorPalette;
  spacing: Spacing;
  typography: Typography;
  radius: Radius;
  layout: Layout;
  transitions: Transitions;
  opacity: Opacity;
  // TODO: Add shadows if they need to be theme-specific
}
