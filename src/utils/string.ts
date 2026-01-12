/**
 * String manipulation utilities
 * Provides helpers for common string operations
 */

/**
 * Capitalize first letter of a string
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string to specified length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - String to append when truncated
 * @returns Truncated string
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis = "...",
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Convert camelCase to kebab-case
 * @param str - CamelCase string
 * @returns kebab-case string
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 * @param str - kebab-case string
 * @returns camelCase string
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert snake_case to camelCase
 * @param str - snake_case string
 * @returns camelCase string
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 * @param str - camelCase string
 * @returns snake_case string
 */
export function camelToSnake(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Slugify a string for use in URLs
 * @param str - String to slugify
 * @returns URL-safe slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Remove markdown formatting from string
 * @param str - String with markdown
 * @returns Plain text string
 */
export function stripMarkdown(str: string): string {
  return (
    str
      // Remove headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      // Remove strikethrough
      .replace(/~~(.*?)~~/g, "$1")
      // Remove code
      .replace(/`{1,3}[^`\n]*`{1,3}/g, "")
      // Remove links
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      // Remove images
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")
      // Remove blockquotes
      .replace(/^\s*>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "")
      // Remove list markers
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .trim()
  );
}

/**
 * Extract first N words from a string
 * @param str - String to extract from
 * @param wordCount - Number of words to extract
 * @param ellipsis - String to append if truncated
 * @returns Extracted words
 */
export function extractWords(
  str: string,
  wordCount: number,
  ellipsis = "...",
): string {
  const words = str.trim().split(/\s+/);
  if (words.length <= wordCount) return str;
  return words.slice(0, wordCount).join(" ") + ellipsis;
}

/**
 * Count words in a string
 * @param str - String to count words in
 * @returns Word count
 */
export function wordCount(str: string): number {
  return str.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Escape HTML special characters
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Unescape HTML entities
 * @param str - String to unescape
 * @returns Unescaped string
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => htmlUnescapes[entity]);
}

/**
 * Check if string is empty or only whitespace
 * @param str - String to check
 * @returns True if empty or whitespace only
 */
export function isBlank(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string is not empty and contains non-whitespace
 * @param str - String to check
 * @returns True if not blank
 */
export function isPresent(str: string | null | undefined): boolean {
  return !isBlank(str);
}

/**
 * Pad string to specified length
 * @param str - String to pad
 * @param length - Target length
 * @param padChar - Character to pad with
 * @param padLeft - Whether to pad on left (default) or right
 * @returns Padded string
 */
export function pad(
  str: string,
  length: number,
  padChar = " ",
  padLeft = true,
): string {
  if (str.length >= length) return str;
  const padding = padChar.repeat(length - str.length);
  return padLeft ? padding + str : str + padding;
}

/**
 * Remove extra whitespace from string
 * @param str - String to normalize
 * @returns String with normalized whitespace
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Extract initials from a name
 * @param name - Full name
 * @param maxInitials - Maximum number of initials to extract
 * @returns Initials (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string, maxInitials = 2): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, maxInitials)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Generate a random string
 * @param length - Length of string to generate
 * @param charset - Character set to use
 * @returns Random string
 */
export function randomString(
  length: number,
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Compare two strings case-insensitively
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal (case-insensitive)
 */
export function equalsIgnoreCase(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Check if string contains substring (case-insensitive)
 * @param str - String to search in
 * @param search - Substring to search for
 * @returns True if substring is found
 */
export function containsIgnoreCase(str: string, search: string): boolean {
  return str.toLowerCase().includes(search.toLowerCase());
}
