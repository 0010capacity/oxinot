/**
 * Centralized style constants for hybrid rendering
 *
 * This file contains all the magic numbers, style strings, and theme values
 * used throughout the markdown rendering system. Centralizing these makes
 * it easier to maintain consistency and adjust the visual appearance.
 */

/**
 * Heading font sizes (multiplier relative to base font)
 * Index corresponds to heading level (0 = H1, 5 = H6)
 */
export const HEADING_SIZES = [2.2, 2.0, 1.8, 1.6, 1.4, 1.2];

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
  marginLeft: "4px",
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
 * Helper function to get heading size for a given level
 */
export function getHeadingSize(level: number): number {
  if (level < 1 || level > 6) {
    return 1; // Default to base size
  }
  return HEADING_SIZES[level - 1];
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
 */
export function getHeadingStyle(level: number): string {
  const size = getHeadingSize(level);
  const weight = getHeadingWeight(level);
  return `
    font-weight: ${weight};
    font-size: ${size}em;
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
 */
export function getInlineCodeStyle(): string {
  return `
    font-family: ${CODE_STYLES.fontFamily};
    background-color: ${CODE_STYLES.backgroundColor};
    padding: ${CODE_STYLES.padding};
    border-radius: ${CODE_STYLES.borderRadius};
    font-size: ${CODE_STYLES.fontSize};
  `.trim();
}

/**
 * Helper function to build blockquote style string
 */
export function getBlockquoteStyle(): string {
  return `
    border-left: ${BLOCKQUOTE_STYLES.borderLeft};
    padding-left: ${BLOCKQUOTE_STYLES.paddingLeft};
    margin-left: ${BLOCKQUOTE_STYLES.marginLeft};
    color: ${BLOCKQUOTE_STYLES.color};
    font-style: ${BLOCKQUOTE_STYLES.fontStyle};
  `.trim();
}

/**
 * Helper function to build link style string
 */
export function getLinkStyle(): string {
  return `
    color: ${LINK_STYLES.color};
    text-decoration: ${LINK_STYLES.textDecoration};
    cursor: ${LINK_STYLES.cursor};
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
 */
export function getTableHeaderStyle(): string {
  return `
    font-weight: ${TABLE_STYLES.headerFontWeight};
    background: ${TABLE_STYLES.headerBackground};
  `.trim();
}

/**
 * Helper function to build strikethrough style string
 */
export function getStrikethroughStyle(): string {
  return `
    text-decoration: ${STRIKETHROUGH_STYLES.textDecoration};
    opacity: ${STRIKETHROUGH_STYLES.opacity};
  `.trim();
}

/**
 * Helper function to build footnote reference style string
 */
export function getFootnoteRefStyle(): string {
  return `
    color: ${FOOTNOTE_STYLES.reference.color};
    font-size: ${FOOTNOTE_STYLES.reference.fontSize};
    vertical-align: ${FOOTNOTE_STYLES.reference.verticalAlign};
    cursor: ${FOOTNOTE_STYLES.reference.cursor};
  `.trim();
}

/**
 * Helper function to build footnote definition style string
 */
export function getFootnoteDefStyle(): string {
  return `
    color: ${FOOTNOTE_STYLES.definition.color};
    font-size: ${FOOTNOTE_STYLES.definition.fontSize};
    font-style: ${FOOTNOTE_STYLES.definition.fontStyle};
    opacity: ${FOOTNOTE_STYLES.definition.opacity};
  `.trim();
}
