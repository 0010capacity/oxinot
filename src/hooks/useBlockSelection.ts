import { useBlockUIStore } from "../stores/blockUIStore";

/**
 * Hook to check if a specific block is selected.
 *
 * Uses the store's built-in isBlockSelected method for consistency
 * and to avoid repeated .includes() checks across the codebase.
 *
 * @param blockId - The block ID to check
 * @returns True if the block is in the selection, false otherwise
 *
 * @example
 * const isSelected = useIsBlockSelected("block-123");
 * // Returns true if "block-123" is in selectedBlockIds
 */
export function useIsBlockSelected(blockId: string): boolean {
  return useBlockUIStore((state) => state.isBlockSelected(blockId));
}

/**
 * Hook to check if any blocks are currently selected.
 *
 * @returns True if selectedBlockIds array is not empty
 *
 * @example
 * const hasSelection = useHasBlockSelection();
 * // Returns true if any blocks are selected
 */
export function useHasBlockSelection(): boolean {
  return useBlockUIStore((state) => state.hasSelection());
}

/**
 * Hook to get the count of selected blocks.
 *
 * Useful for determining if this is a batch operation (count > 1)
 *
 * @returns Number of selected blocks
 *
 * @example
 * const count = useBlockSelectionCount();
 * if (count > 1) {
 *   // Show batch operation UI
 * }
 */
export function useBlockSelectionCount(): number {
  return useBlockUIStore((state) => state.selectedBlockIds.length);
}

/**
 * Hook to check if a batch operation is in progress.
 *
 * A batch operation is defined as having 2 or more blocks selected.
 *
 * @returns True if more than 1 block is selected
 *
 * @example
 * const isBatch = useIsBatchOperation();
 * if (isBatch) {
 *   // Show "Indent (5)" instead of just "Indent"
 * }
 */
export function useIsBatchOperation(): boolean {
  return useBlockUIStore((state) => state.selectedBlockIds.length > 1);
}
