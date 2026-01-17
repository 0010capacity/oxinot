/**
 * Layout constants
 * Centralized layout values for consistent spacing and sizing
 */

/**
 * Maximum content width for centered layouts
 */
export const MAX_CONTENT_WIDTH = "1200px";

/**
 * Container padding values
 */
export const CONTAINER_PADDING = {
  desktop: "24px",
  tablet: "16px",
  mobile: "12px",
} as const;

/**
 * Content area bottom padding to prevent overlap with bottom UI
 */
export const CONTENT_BOTTOM_PADDING = "120px";

/**
 * Title bar height
 */
export const TITLE_BAR_HEIGHT = "48px";

/**
 * Block editor layout values
 */
export const BLOCK_LAYOUT = {
  /** Size of bullet point */
  bulletSize: "8px",
  /** Size of bullet point container */
  bulletContainerSize: "24px",
  /** Size of collapse/expand toggle */
  collapseToggleSize: "16px",
  /** Indent size per level */
  indentSize: "24px",
  /** Vertical padding for block rows */
  blockPadding: "2px",
  /** Gap between block elements */
  blockGap: "var(--spacing-sm)",
} as const;

/**
 * File tree layout values
 */
export const INDENT_PER_LEVEL = 24;

export const FILE_TREE_LAYOUT = {
  /** Indent per nesting level */
  indentSize: `${INDENT_PER_LEVEL}px`,
  /** Item height */
  itemHeight: "28px",
  /** Icon size */
  iconSize: "16px",
  /** Gap between elements */
  gap: "var(--spacing-sm)",
} as const;

/**
 * Modal and dialog sizes
 */
export const MODAL_SIZES = {
  small: "400px",
  medium: "600px",
  large: "800px",
  xlarge: "1000px",
} as const;

/**
 * Sidebar dimensions
 */
export const SIDEBAR = {
  width: "280px",
  minWidth: "200px",
  maxWidth: "400px",
} as const;

/**
 * Header and footer heights
 */
export const HEADER_HEIGHT = "60px";
export const FOOTER_HEIGHT = "40px";

/**
 * Z-index layers
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  xs: 576,
  sm: 768,
  md: 992,
  lg: 1200,
  xl: 1400,
} as const;

/**
 * Media query helpers
 */
export const MEDIA_QUERIES = {
  xs: `@media (max-width: ${BREAKPOINTS.xs}px)`,
  sm: `@media (max-width: ${BREAKPOINTS.sm}px)`,
  md: `@media (max-width: ${BREAKPOINTS.md}px)`,
  lg: `@media (max-width: ${BREAKPOINTS.lg}px)`,
  xl: `@media (max-width: ${BREAKPOINTS.xl}px)`,
  minXs: `@media (min-width: ${BREAKPOINTS.xs + 1}px)`,
  minSm: `@media (min-width: ${BREAKPOINTS.sm + 1}px)`,
  minMd: `@media (min-width: ${BREAKPOINTS.md + 1}px)`,
  minLg: `@media (min-width: ${BREAKPOINTS.lg + 1}px)`,
  minXl: `@media (min-width: ${BREAKPOINTS.xl + 1}px)`,
} as const;

/**
 * Grid layout values
 */
export const GRID = {
  columns: 12,
  gutter: "16px",
  gutterSmall: "8px",
  gutterLarge: "24px",
} as const;

/**
 * Common spacing multipliers
 */
export const SPACING_SCALE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * Border radius values
 */
export const BORDER_RADIUS = {
  none: "0",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  round: "50%",
  pill: "9999px",
} as const;

/**
 * Shadow definitions
 */
export const SHADOWS = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  xxl: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
} as const;
