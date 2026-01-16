import type { BlockData } from "./blockStore";

/**
 * Determines where to insert a new block relative to a current block.
 * Rule:
 * 1. If current block has children: insert as FIRST CHILD.
 * 2. Else: insert as NEXT SIBLING.
 */
export function getInsertBelowTarget(
  currentId: string,
  blocksById: Record<string, BlockData>,
  childrenMap: Record<string, string[]>
): { parentId: string | null; afterBlockId: string | null } {
  const currentBlock = blocksById[currentId];
  const hasChildren = (childrenMap[currentId] ?? []).length > 0;

  if (hasChildren) {
    // Rule: First child
    return {
      parentId: currentId,
      afterBlockId: null, // null means "at start" (first child)
    };
  }

  // Rule: Next sibling
  return {
    parentId: currentBlock?.parentId ?? null,
    afterBlockId: currentId,
  };
}

/**
 * Rebuilds the childrenMap for specified parent IDs.
 * Used after blocks are added, updated, or deleted.
 */
export function rebuildChildrenMapForParents(
  parentIds: Set<string>,
  blocksById: Record<string, BlockData>,
  currentChildrenMap: Record<string, string[]>
): Record<string, string[]> {
  const updated = { ...currentChildrenMap };

  for (const parentId of parentIds) {
    const parentKey = parentId === "root" ? "root" : parentId;
    updated[parentKey] = Object.values(blocksById)
      .filter((b) => (b.parentId ?? "root") === parentKey)
      .sort((a, b) => a.orderWeight - b.orderWeight)
      .map((b) => b.id);
  }

  return updated;
}

/**
 * Collects affected parent IDs when blocks are updated or deleted.
 * This is needed to rebuild the childrenMap efficiently.
 */
export function collectAffectedParentIds(
  updatedBlocks: BlockData[],
  deletedBlockIds: string[] | undefined,
  blocksById: Record<string, BlockData>
): Set<string> {
  const affectedParentIds = new Set<string>();

  // Add parents of updated/added blocks (including previous parent for moves)
  for (const block of updatedBlocks) {
    const existing = blocksById[block.id];
    if (existing && existing.parentId !== block.parentId) {
      affectedParentIds.add(existing.parentId ?? "root");
    }
    affectedParentIds.add(block.parentId ?? "root");
  }

  // Add parents of deleted blocks (BEFORE deleting them!)
  if (deletedBlockIds) {
    for (const id of deletedBlockIds) {
      const block = blocksById[id];
      if (block) {
        affectedParentIds.add(block.parentId ?? "root");
      }
    }
  }

  return affectedParentIds;
}

/**
 * Initializes and normalizes blocks into blocksById and childrenMap.
 */
export function normalizeBlocks(blocks: BlockData[]): {
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;
} {
  const blocksById: Record<string, BlockData> = {};
  const childrenMap: Record<string, string[]> = { root: [] };

  for (const block of blocks) {
    blocksById[block.id] = block;

    const parentKey = block.parentId ?? "root";
    if (!childrenMap[parentKey]) {
      childrenMap[parentKey] = [];
    }
    childrenMap[parentKey].push(block.id);
  }

  // Sort by orderWeight
  for (const key of Object.keys(childrenMap)) {
    childrenMap[key].sort((a, b) => {
      return blocksById[a].orderWeight - blocksById[b].orderWeight;
    });
  }

  return { blocksById, childrenMap };
}

/**
 * Finds the next block in depth-first order.
 */
export function findNextBlockInOrder(
  currentId: string,
  blocksById: Record<string, BlockData>,
  childrenMap: Record<string, string[]>,
  visibleCollapsedSet?: Set<string>
): string | null {
  const children = childrenMap[currentId] ?? [];
  const isCollapsed = blocksById[currentId]?.isCollapsed ?? false;

  // If current block has visible children, return first child
  if (
    children.length > 0 &&
    (!isCollapsed || visibleCollapsedSet?.has(currentId))
  ) {
    return children[0] ?? null;
  }

  // Otherwise, find next sibling or traverse up
  const currentBlock = blocksById[currentId];
  let parentId = currentBlock?.parentId ?? null;
  let traversalId = currentId;

  while (parentId !== null || parentId === null) {
    const siblings = childrenMap[parentId ?? "root"] ?? [];
    const currentIndex = siblings.indexOf(traversalId);

    if (currentIndex !== -1 && currentIndex < siblings.length - 1) {
      return siblings[currentIndex + 1] ?? null;
    }

    // Move up to parent
    if (parentId === null) break;
    const parentBlock = blocksById[parentId];
    traversalId = parentId;
    parentId = parentBlock?.parentId ?? null;
  }

  return null;
}

/**
 * Finds the previous block in depth-first order.
 */
export function findPreviousBlockInOrder(
  currentId: string,
  blocksById: Record<string, BlockData>,
  childrenMap: Record<string, string[]>
): string | null {
  const currentBlock = blocksById[currentId];
  const parentId = currentBlock?.parentId ?? null;
  const siblings = childrenMap[parentId ?? "root"] ?? [];
  const currentIndex = siblings.indexOf(currentId);

  if (currentIndex > 0) {
    // There's a previous sibling
    let prevSiblingId = siblings[currentIndex - 1];

    // If previous sibling has children, go to its last descendant
    while (true) {
      const children = childrenMap[prevSiblingId] ?? [];
      if (children.length === 0) break;
      prevSiblingId = children[children.length - 1] ?? prevSiblingId;
    }

    return prevSiblingId;
  }

  // No previous sibling; parent is the previous block
  return parentId;
}
