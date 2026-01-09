export type ColorScheme = "dark" | "light";
export type ColorVariant = "default" | "blue" | "purple" | "green" | "amber";

export interface Theme {
  scheme: ColorScheme;
  variant: ColorVariant;
  colors: ColorPalette;
  spacing: Spacing;
  typography: Typography;
  radius: Radius;
}

export interface ColorPalette {
  // Background colors
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
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
}

export interface Spacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface Typography {
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
  sm: string;
  md: string;
  lg: string;
}
