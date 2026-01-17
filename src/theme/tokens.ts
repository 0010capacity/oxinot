export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const TYPOGRAPHY = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  monoFontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
  fontSize: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "24px",
  },
  lineHeight: {
    tight: "1.3",
    normal: "1.5",
    relaxed: "1.6",
  },
} as const;

export const RADIUS = {
  sm: "3px",
  md: "6px",
  lg: "12px",
} as const;

export const LAYOUT = {
  maxContentWidth: "800px",
  containerPadding: "40px 20px",
  containerPaddingMobile: "20px 12px",
  contentBottomPadding: "200px",
  titleBarHeight: "44px",
  bulletSize: "6px",
  bulletContainerSize: "24px",
  collapseToggleSize: "20px",
  indentSize: 24,
} as const;

export const TRANSITIONS = {
  fast: "0.1s ease",
  normal: "0.15s ease",
  slow: "0.2s ease",
} as const;

export const OPACITY = {
  disabled: "0.3",
  dimmed: "0.5",
  hover: "0.6",
  active: "0.85",
} as const;

export const Z_INDEX = {
  base: 0,
  low: 1,
  elevated: 10,
  dropdown: 1000,
  sticky: 1020,
  backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 2000,
} as const;
