import { Block } from "./types";
import { FENCE_MARKERS, CODE_MARKERS } from "./constants";

/**
 * Check if content should trigger fence block conversion
 */
export function shouldConvertToFence(
  block: Block,
  content: string,
): boolean {
  return (
    block.kind !== "fence" && content.trim() === FENCE_MARKERS.DELIMITER
  );
}

/**
 * Check if content should trigger code block conversion
 */
export function shouldConvertToCode(block: Block, content: string): boolean {
  if (block.kind === "code") return false;
  return content.trim().startsWith(CODE_MARKERS.FENCE);
}

/**
 * Extract language from code block trigger
 * Returns the language string or empty string if no language specified
 */
export function extractCodeLanguage(content: string): string | null {
  const match = content.trim().match(/^```(\w*)$/);
  return match ? match[1] || "" : null;
}

/**
 * Result of block conversion check
 */
export interface ConversionResult {
  shouldConvert: boolean;
  kind?: "fence" | "code";
  language?: string;
}

/**
 * Check if block content should trigger auto-conversion
 * Returns conversion info if conversion should happen, null otherwise
 */
export function checkBlockConversion(
  block: Block,
  content: string,
): ConversionResult | null {
  // Check for fence conversion
  if (shouldConvertToFence(block, content)) {
    return {
      shouldConvert: true,
      kind: "fence",
    };
  }

  // Check for code conversion
  if (shouldConvertToCode(block, content)) {
    const language = extractCodeLanguage(content);
    if (language !== null) {
      return {
        shouldConvert: true,
        kind: "code",
        language,
      };
    }
  }

  return null;
}
