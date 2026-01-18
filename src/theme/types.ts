export type ColorScheme = "dark" | "light";
export type ColorVariant = "indigo" | "blue" | "purple" | "green" | "amber";

export interface Theme {
  scheme: ColorScheme;
  variant: ColorVariant;
  colors: ColorPalette;
  spacing: Spacing;
  typography: Typography;
  radius: Radius;
}

export interface ColorPalette {
  [key: string]: unknown; // Changed from any to unknown
  // Background colors
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
    overlay: string;
  };

  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    link: string;
  };

  // Border colors
  border: {
    primary: string;
    secondary: string;
    focus: string;
  };

  // Interactive colors
  interactive: {
    hover: string;
    active: string;
    selected: string;
    focus: string;
  };

  // Semantic colors
  accent: string;
  success: string;
  warning: string;
  error: string;

  // Component-specific
  bullet: {
    default: string;
    hover: string;
    active: string;
  };

  indentGuide: string;

  // Graph visualization
  graph: {
    nodePage: string;
    nodeBlock: string;
  };
}

export interface Spacing {
  [key: string]: unknown; // Changed from any to unknown
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface Typography {
  [key: string]: unknown; // Changed from any to unknown
  fontFamily: string;
  monoFontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

export interface Radius {
  [key: string]: unknown; // Changed from any to unknown
  sm: string;
  md: string;
  lg: string;
}
