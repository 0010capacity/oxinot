/**
 * Outliner configuration constants
 */

/**
 * Number of spaces that represent one indentation level
 */
export const INDENT_SIZE = 2;

/**
 * Minimum indentation level (root level)
 */
export const MIN_LEVEL = 0;

/**
 * Maximum indentation level to prevent excessive nesting
 */
export const MAX_LEVEL = 10;

/**
 * Default debounce delay for onChange callbacks (in milliseconds)
 */
export const ONCHANGE_DEBOUNCE_MS = 200;

/**
 * Delay for auto-focusing newly created blocks (in milliseconds)
 */
export const AUTO_FOCUS_DELAY_MS = 10;

/**
 * IME composition flush timeout (in milliseconds)
 */
export const IME_FLUSH_TIMEOUT_MS = 50;

/**
 * Fence block markers (/// delimited blocks)
 */
export const FENCE_MARKERS = {
  DELIMITER: "///",
} as const;

/**
 * Code block markers
 */
export const CODE_MARKERS = {
  FENCE: "```",
} as const;

/**
 * Block kind types
 */
export const BLOCK_KINDS = {
  BULLET: "bullet",
  FENCE: "fence",
  CODE: "code",
} as const;
