/**
 * Centralized style constants for hybrid rendering
 *
 * This file contains all the magic numbers, style strings, and theme values
 * used throughout the markdown rendering system. Centralizing these makes
 * it easier to maintain consistency and adjust the visual appearance.
 */

/**
 * Heading CSS variable names by level
 * These correspond to --heading-size-h1 through --heading-size-h6 in variables.css
 */
const HEADING_CSS_VARS = {
  1: "--heading-size-h1",
  2: "--heading-size-h2",
  3: "--heading-size-h3",
  4: "--heading-size-h4",
  5: "--heading-size-h5",
  6: "--heading-size-h6",
} as const;

/**
 * Heading font weights by level
 */
export const HEADING_WEIGHTS = {
  1: "bold",
  2: "bold",
  3: "600",
  4: "600",
  5: "600",
  6: "600",
} as const;

/**
 * Marker visibility styles
 */
export const MARKER_STYLES = {
  /** Completely hidden (when cursor is not on line) */
  hidden: "display: none;",

  /** Dimmed and smaller (when cursor is on line) */
  dimmed: "opacity: 0.4; font-size: 0.85em;",

  /** Slightly visible */
  subtle: "opacity: 0.5;",

  /** Very subtle (for delimiters) */
  verySubtle: "opacity: 0.3;",
} as const;

/**
 * Code block styles
 */
export const CODE_STYLES = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: "0.9em",
  backgroundColor: "rgba(127, 127, 127, 0.1)",
  padding: "0.2em 0.4em",
  borderRadius: "3px",
  lineHeight: "1.5",
} as const;

/**
 * Blockquote styles
 */
export const BLOCKQUOTE_STYLES = {
  borderLeft: "3px solid rgba(127, 127, 127, 0.3)",
  paddingLeft: "12px",
  color: "rgba(127, 127, 127, 0.8)",
  fontStyle: "italic",
} as const;

/**
 * Link styles
 */
export const LINK_STYLES = {
  color: "#0969da",
  textDecoration: "underline",
  cursor: "pointer",
  hoverOpacity: "0.8",
} as const;

/**
 * Table styles
 */
export const TABLE_STYLES = {
  cellPadding: "8px 12px",
  headerFontWeight: "600",
  headerBackground: "rgba(127, 127, 127, 0.1)",
  border: "1px solid rgba(127, 127, 127, 0.2)",
  borderRadius: "4px",
  margin: "16px 0",
} as const;

/**
 * Strikethrough styles
 */
export const STRIKETHROUGH_STYLES = {
  textDecoration: "line-through",
  opacity: "0.7",
} as const;

/**
 * Footnote styles
 */
export const FOOTNOTE_STYLES = {
  reference: {
    color: "#0969da",
    fontSize: "0.85em",
    verticalAlign: "super",
    cursor: "pointer",
  },
  definition: {
    color: "rgba(127, 127, 127, 0.8)",
    fontSize: "0.9em",
    fontStyle: "italic",
    opacity: "0.8",
  },
} as const;

/**
 * Task list checkbox styles
 */
export const CHECKBOX_STYLES = {
  accentColor: "#0969da",
  marginRight: "8px",
  cursor: "pointer",
} as const;

/**
 * Helper function to get heading CSS variable for a given level
 */
export function getHeadingSize(level: number): string {
  if (level < 1 || level > 6) {
    return "1em"; // Default to base size
  }
  return `var(${HEADING_CSS_VARS[level as keyof typeof HEADING_CSS_VARS]})`;
}

/**
 * Helper function to get heading weight for a given level
 */
export function getHeadingWeight(level: number): string {
  if (level < 1 || level > 6) {
    return "normal";
  }
  return HEADING_WEIGHTS[level as keyof typeof HEADING_WEIGHTS];
}
/**
 * Helper function to build heading style string
 * Uses CSS variables for consistency with static renderer
 */
export function getHeadingStyle(level: number): string {
  const weight = getHeadingWeight(level);
  const sizeVar =
    level >= 1 && level <= 6
      ? HEADING_CSS_VARS[level as keyof typeof HEADING_CSS_VARS]
      : "--heading-size-h6";
  return `
    font-weight: ${weight};
    font-size: var(${sizeVar});
    line-height: 1.3;
    text-decoration: none;
    border-bottom: none;
  `.trim();
}

/**
 * Helper function to get marker visibility style based on cursor position
 */
export function getMarkerStyle(isOnCursorLine: boolean): string {
  return isOnCursorLine ? MARKER_STYLES.dimmed : MARKER_STYLES.hidden;
}

/**
 * Helper function to build inline code style string
 * Uses CSS variables for consistency with static renderer
 */
export function getInlineCodeStyle(): string {
  return `
    font-family: var(--font-family-mono);
    background-color: var(--color-bg-tertiary);
    padding: var(--inline-element-padding);
    border-radius: var(--inline-element-border-radius);
    font-size: 0.9em;
  `.trim();
}

/**
 * Helper function to build blockquote style string
 * Uses CSS variables for consistency with static renderer
 */
export function getBlockquoteStyle(): string {
  return `
    border-left: 3px solid var(--color-border-secondary);
    padding-left: var(--spacing-md);
    color: var(--color-text-secondary);
    font-style: italic;
  `.trim();
}

/**
 * Helper function to build link style string
 * Uses CSS variables for consistency with static renderer
 */
export function getLinkStyle(): string {
  return `
    color: var(--color-accent);
    text-decoration: none;
    cursor: pointer;
  `.trim();
}

/**
 * Helper function to build table cell style string
 */
export function getTableCellStyle(): string {
  return `
    padding: ${TABLE_STYLES.cellPadding};
  `.trim();
}

/**
 * Helper function to build table header style string
 * Uses CSS variables for consistency with static renderer
 */
export function getTableHeaderStyle(): string {
  return `
    font-weight: 600;
    background: var(--color-bg-tertiary);
  `.trim();
}

/**
 * Helper function to build strikethrough style string
 */
export function getStrikethroughStyle(): string {
  return `
    text-decoration: line-through;
    opacity: 0.7;
  `.trim();
}

/**
 * Helper function to build footnote reference style string
 * Uses CSS variables for consistency with static renderer
 */
export function getFootnoteRefStyle(): string {
  return `
    color: var(--color-accent);
    font-size: 0.85em;
    vertical-align: super;
    cursor: pointer;
  `.trim();
}

/**
 * Helper function to build footnote definition style string
 * Uses CSS variables for consistency with static renderer
 */
export function getFootnoteDefStyle(): string {
  return `
    color: var(--color-text-tertiary);
    font-size: 0.9em;
    font-style: italic;
    opacity: 0.8;
  `.trim();
}

/**
 * Helper function to build highlight style string
 * Uses CSS variables for consistency with static renderer
 */
export function getHighlightStyle(): string {
  return `
    background: var(--color-highlight-bg);
    padding: 0.1em 0.2em;
    border-radius: 2px;
    font-weight: 500;
  `.trim();
}
