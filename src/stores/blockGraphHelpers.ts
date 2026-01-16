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
 * Efficiently updates childrenMap based on updated and deleted blocks.
 * Avoids O(N) full traversal by only processing affected parents.
 *
 * NOTE: blocksById must still contain the blocks being deleted during this call
 * if we want to find their parents, OR the caller must provide affected parent IDs.
 */
export function updateChildrenMap(
  childrenMap: Record<string, string[]>,
  blocksById: Record<string, BlockData>,
  updatedBlocks: BlockData[],
  deletedBlockIds: string[] = []
): void {
  const affectedParentIds = new Set<string>();

  // 1. Handle deleted blocks: remove from their parents
  for (const id of deletedBlockIds) {
    const block = blocksById[id];
    if (block) {
      const parentKey = block.parentId ?? "root";
      if (childrenMap[parentKey]) {
        childrenMap[parentKey] = childrenMap[parentKey].filter(
          (cid) => cid !== id
        );
        affectedParentIds.add(parentKey);
      }
    }
    // Also remove the deleted block's own children list
    delete childrenMap[id];
  }

  // 2. Handle updated/added blocks
  for (const block of updatedBlocks) {
    const existing = blocksById[block.id];
    const newParentKey = block.parentId ?? "root";

    if (existing) {
      const oldParentKey = existing.parentId ?? "root";
      if (oldParentKey !== newParentKey) {
        // Parent changed: remove from old parent
        if (childrenMap[oldParentKey]) {
          childrenMap[oldParentKey] = childrenMap[oldParentKey].filter(
            (cid) => cid !== block.id
          );
          affectedParentIds.add(oldParentKey);
        }

        // Add to new parent
        if (!childrenMap[newParentKey]) {
          childrenMap[newParentKey] = [];
        }
        if (!childrenMap[newParentKey].includes(block.id)) {
          childrenMap[newParentKey].push(block.id);
        }
        affectedParentIds.add(newParentKey);
      } else {
        // Parent same, but orderWeight or other metadata might have changed
        // Ensure it's in the list (might be new if it's the first time we see it)
        if (!childrenMap[newParentKey]) {
          childrenMap[newParentKey] = [];
        }
        if (!childrenMap[newParentKey].includes(block.id)) {
          childrenMap[newParentKey].push(block.id);
        }
        affectedParentIds.add(newParentKey);
      }
    } else {
      // New block: add to parent
      if (!childrenMap[newParentKey]) {
        childrenMap[newParentKey] = [];
      }
      if (!childrenMap[newParentKey].includes(block.id)) {
        childrenMap[newParentKey].push(block.id);
      }
      affectedParentIds.add(newParentKey);
    }
  }

  // 3. Re-sort children for affected parents
  // Create a temporary map of updated weights for faster lookup during sort
  const updatedWeights = new Map(updatedBlocks.map((b) => [b.id, b.orderWeight]));

  for (const parentKey of affectedParentIds) {
    const list = childrenMap[parentKey];
    if (list) {
      list.sort((a, b) => {
        const wA = updatedWeights.get(a) ?? blocksById[a]?.orderWeight ?? 0;
        const wB = updatedWeights.get(b) ?? blocksById[b]?.orderWeight ?? 0;
        return wA - wB;
      });
    }
  }
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
