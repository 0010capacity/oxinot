import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";

/**
 * Batch delete blocks
 */
export async function deleteBlocks(blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return;

  const deleteBlock = useBlockStore.getState().deleteBlock;

  // Delete all blocks
  for (const blockId of blockIds) {
    await deleteBlock(blockId);
  }

  // Clear selection after deletion
  useBlockUIStore.getState().clearSelectedBlocks();
}

/**
 * Batch indent blocks
 */
export async function indentBlocks(blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return;

  const indentBlock = useBlockStore.getState().indentBlock;

  for (const blockId of blockIds) {
    await indentBlock(blockId);
  }
}

/**
 * Batch outdent blocks
 */
export async function outdentBlocks(blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return;

  const outdentBlock = useBlockStore.getState().outdentBlock;

  for (const blockId of blockIds) {
    await outdentBlock(blockId);
  }
}

/**
 * Toggle collapse state for multiple blocks with children
 */
export async function toggleCollapseBlocks(blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return;

  const toggleCollapse = useBlockStore.getState().toggleCollapse;
  const blocksById = useBlockStore.getState().blocksById;
  const childrenMap = useBlockStore.getState().childrenMap;

  for (const blockId of blockIds) {
    const block = blocksById[blockId];
    const children = childrenMap[blockId] || [];
    // Only toggle if block has children
    if (block && children.length > 0) {
      toggleCollapse(blockId);
    }
  }
}

/**
 * Change block type for multiple blocks
 */
export async function changeBlockType(
  blockIds: string[],
  newType: "bullet" | "code" | "fence",
): Promise<void> {
  if (blockIds.length === 0) return;

  const updateBlock = useBlockStore.getState().updateBlock;

  for (const blockId of blockIds) {
    await updateBlock(blockId, { blockType: newType });
  }
}

/**
 * Copy selected block IDs to clipboard (for linking)
 */
export async function copyBlockIdsToClipboard(
  blockIds: string[],
): Promise<void> {
  if (blockIds.length === 0) return;

  const text = blockIds.join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    throw err;
  }
}

/**
 * Check if blocks can be indented
 */
export function canIndentBlocks(blockIds: string[]): boolean {
  if (blockIds.length === 0) return false;

  const blocksById = useBlockStore.getState().blocksById;
  return blockIds.every((id) => blocksById[id]);
}

/**
 * Check if blocks can be outdented
 */
export function canOutdentBlocks(blockIds: string[]): boolean {
  if (blockIds.length === 0) return false;

  const blocksById = useBlockStore.getState().blocksById;
  return blockIds.some((id) => {
    const block = blocksById[id];
    return block && block.parentId !== null;
  });
}

/**
 * Check if all selected blocks can be collapsed
 */
export function canCollapseBlocks(blockIds: string[]): boolean {
  if (blockIds.length === 0) return false;

  const childrenMap = useBlockStore.getState().childrenMap;

  for (const blockId of blockIds) {
    const children = childrenMap[blockId];
    if (children && children.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get count of blocks with children in selection
 */
export function getCollapsibleBlockCount(blockIds: string[]): number {
  const childrenMap = useBlockStore.getState().childrenMap;
  return blockIds.filter((id) => {
    const children = childrenMap[id];
    return children && children.length > 0;
  }).length;
}
