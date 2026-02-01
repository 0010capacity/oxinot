/**
 * Utility functions for calculating cursor positions during keyboard navigation.
 *
 * These functions extract the position calculation logic from arrow key handlers
 * to avoid duplicating code and enable potential memoization in the future.
 */

/**
 * Calculate the target cursor position when navigating to the previous block.
 *
 * When moving from the first line of the current block to the previous block,
 * we want to position the cursor on the last line of the previous block at
 * the same column position as the current cursor.
 *
 * @param currentColumnPos - The column position within the current line
 * @param previousBlockContent - The full content of the previous block (may contain newlines)
 * @returns The absolute cursor position in the previous block, or null if calculation fails
 *
 * @example
 * // Current block content: "hello" (cursor at position 3, column 3)
 * // Previous block content: "foo\nbar" (3 chars, newline, 3 chars)
 * // Result: 7 (position in "bar" where we want to be at column 3)
 */
export function calculatePrevBlockCursorPosition(
  currentColumnPos: number,
  previousBlockContent: string,
): number {
  const lines = previousBlockContent.split("\n");
  const lastLine = lines[lines.length - 1];

  // Calculate position: sum of all previous lines + target column
  let targetPos = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    targetPos += lines[i].length + 1; // +1 for newline
  }
  targetPos += Math.min(currentColumnPos, lastLine.length);

  return targetPos;
}

/**
 * Calculate the target cursor position when navigating to the next block.
 *
 * When moving from the last line of the current block to the next block,
 * we want to position the cursor on the first line of the next block at
 * the same column position as the current cursor.
 *
 * @param currentColumnPos - The column position within the current line
 * @param nextBlockContent - The full content of the next block (may contain newlines)
 * @returns The absolute cursor position in the next block
 *
 * @example
 * // Current block content: "hello" (cursor at position 3, column 3)
 * // Next block content: "foo\nbar" (3 chars, newline, 3 chars)
 * // Result: 3 (position in "foo" where we want to be at column 3)
 */
export function calculateNextBlockCursorPosition(
  currentColumnPos: number,
  nextBlockContent: string,
): number {
  const firstLine = nextBlockContent.split("\n")[0];
  return Math.min(currentColumnPos, firstLine.length);
}

/**
 * Batch calculate cursor positions for multiple lines of content.
 *
 * Useful for cases where you need to calculate positions for multiple
 * blocks at once, as it avoids repeated string splitting.
 *
 * @param contentArray - Array of block content strings
 * @param columnPos - The column position to target
 * @returns Array of cursor positions, one per block
 */
export function batchCalculateCursorPositions(
  contentArray: string[],
  columnPos: number,
): number[] {
  return contentArray.map((content) => {
    const firstLine = content.split("\n")[0];
    return Math.min(columnPos, firstLine.length);
  });
}
