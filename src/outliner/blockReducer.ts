import { BlockAction, Block } from "./types";
import {
  createBlock,
  flattenBlocks,
  buildBlockTree,
  canIndent,
  canOutdent,
  getPreviousBlock,
} from "./blockUtils";
import { debug } from "./debug";

function countAllBlocks(blocks: Block[]): number {
  let count = 0;
  const stack = [...blocks];
  while (stack.length > 0) {
    const block = stack.pop()!;
    count++;
    stack.push(...block.children);
  }
  return count;
}

function markBlockAndDescendantsForRemoval(block: Block): Set<string> {
  const toRemove = new Set<string>([block.id]);

  const stack: Block[] = [...block.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    toRemove.add(current.id);
    stack.push(...current.children);
  }

  return toRemove;
}

function collectDescendants(block: Block): Block[] {
  const descendants: Block[] = [];
  const stack: Block[] = [...block.children];

  while (stack.length > 0) {
    const current = stack.pop()!;
    descendants.push(current);
    stack.push(...current.children);
  }

  return descendants;
}

function increaseDescendantLevels(block: Block, delta: number) {
  const stack: Block[] = [...block.children];

  while (stack.length > 0) {
    const current = stack.pop()!;
    current.level += delta;
    stack.push(...current.children);
  }
}

export function blockReducer(blocks: Block[], action: BlockAction): Block[] {
  switch (action.type) {
    case "ADD_BLOCK": {
      const { afterBlockId, level, content } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === afterBlockId);
      const currentBlock = index !== -1 ? flatBlocks[index] : null;
      const childrenOfCurrent = currentBlock ? currentBlock.children : [];

      debug.log("[blockReducer] ADD_BLOCK", {
        afterBlockId,
        level,
        currentBlockLevel: currentBlock?.level,
        currentBlockChildrenCount: childrenOfCurrent.length,
        blocksCountRoot: blocks.length,
        blocksCountAll: countAllBlocks(blocks),
      });

      if (!afterBlockId) {
        // Add at the end
        const newBlock = createBlock(content ?? "", level ?? 0);
        if (action.payload.newBlockId) {
          newBlock.id = action.payload.newBlockId;
        }
        const result = buildBlockTree([...flatBlocks, newBlock]);
        debug.log("[blockReducer] ADD_BLOCK result", {
          newCountRoot: result.length,
          newCountAll: countAllBlocks(result),
        });
        return result;
      }

      if (index === -1 || !currentBlock) return blocks;

      const newBlock = createBlock(content ?? "", level ?? currentBlock.level);
      newBlock.kind = action.payload.kind ?? "bullet";
      if (action.payload.newBlockId) {
        newBlock.id = action.payload.newBlockId;
      }

      // Find insertion point based on new block's level
      let insertIndex = index + 1;

      // If new block is at same level as current (sibling), skip all descendants
      if (
        newBlock.level === currentBlock.level &&
        currentBlock.children.length > 0
      ) {
        const descendants = collectDescendants(currentBlock);
        insertIndex = index + 1 + descendants.length;
      }
      // If new block is level + 1 (child), insert right after parent
      // insertIndex is already set to index + 1, which is correct

      flatBlocks.splice(insertIndex, 0, newBlock);
      const result = buildBlockTree(flatBlocks);
      debug.log("[blockReducer] ADD_BLOCK result", {
        newCountRoot: result.length,
        newCountAll: countAllBlocks(result),
        newBlockLevel: newBlock.level,
        currentBlockChildrenAfter: currentBlock?.children.length,
      });
      return result;
    }

    case "DELETE_BLOCK": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1) return blocks;

      const block = flatBlocks[index];

      // Remove block and all its descendants
      const toRemove = markBlockAndDescendantsForRemoval(block);
      const filtered = flatBlocks.filter((b) => !toRemove.has(b.id));
      return buildBlockTree(filtered);
    }

    case "UPDATE_BLOCK": {
      const { blockId, content } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const block = flatBlocks.find((b) => b.id === blockId);

      if (!block) return blocks;

      block.content = content;
      return buildBlockTree(flatBlocks);
    }

    case "UPDATE_BLOCK_DATA": {
      const { blockId, data } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const blockIndex = flatBlocks.findIndex((b) => b.id === blockId);

      if (blockIndex === -1) return blocks;

      const newBlock = { ...flatBlocks[blockIndex], ...data };
      const newFlatBlocks = [...flatBlocks];
      newFlatBlocks[blockIndex] = newBlock;

      return buildBlockTree(newFlatBlocks);
    }

    case "INDENT_BLOCK": {
      const { blockId } = action.payload;

      if (!canIndent(blocks, blockId)) return blocks;

      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1) return blocks;

      const block = flatBlocks[index];
      const previous = flatBlocks[index - 1];

      // Increase level (will become child of previous block)
      block.level = previous.level + 1;

      // Also increase level of all descendants
      increaseDescendantLevels(block, 1);

      return buildBlockTree(flatBlocks);
    }

    case "OUTDENT_BLOCK": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const block = flatBlocks.find((b) => b.id === blockId);

      if (!block || !canOutdent(block)) return blocks;

      block.level = Math.max(0, block.level - 1);

      // Also decrease level of all descendants
      increaseDescendantLevels(block, -1);
      // Clamp at 0 after shifting
      flatBlocks.forEach((b) => {
        if (b.level < 0) b.level = 0;
      });

      return buildBlockTree(flatBlocks);
    }

    case "MOVE_BLOCK_UP": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index <= 0) return blocks;

      const block = flatBlocks[index];
      const previous = flatBlocks[index - 1];

      // Only swap if they're at the same level
      if (block.level !== previous.level) return blocks;

      // Collect all descendants of current block
      const descendants = collectDescendants(block);

      // Remove all involved blocks from array
      const toMove = [block, ...descendants];
      const filtered = flatBlocks.filter((b) => !toMove.includes(b));

      // Find new insertion point (before previous block)
      const previousIndex = filtered.findIndex((b) => b.id === previous.id);

      // Insert moved blocks before previous
      filtered.splice(previousIndex, 0, ...toMove);

      return buildBlockTree(filtered);
    }

    case "MOVE_BLOCK_DOWN": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1 || index >= flatBlocks.length - 1) return blocks;

      const block = flatBlocks[index];

      // Find next sibling at same level
      let nextSiblingIndex = -1;
      for (let i = index + 1; i < flatBlocks.length; i++) {
        if (flatBlocks[i].level < block.level) break;
        if (flatBlocks[i].level === block.level) {
          nextSiblingIndex = i;
          break;
        }
      }

      if (nextSiblingIndex === -1) return blocks;

      const nextSibling = flatBlocks[nextSiblingIndex];

      // Collect all descendants of current block
      const descendants = collectDescendants(block);

      // Collect all descendants of next sibling
      const nextDescendants = collectDescendants(nextSibling);

      // Remove current block and its descendants
      const toMove = [block, ...descendants];
      const filtered = flatBlocks.filter((b) => !toMove.includes(b));

      // Find where to insert (after next sibling and all its descendants)
      const nextIndex = filtered.findIndex((b) => b.id === nextSibling.id);
      const insertIndex = nextIndex + 1 + nextDescendants.length;

      // Insert moved blocks
      filtered.splice(insertIndex, 0, ...toMove);

      return buildBlockTree(filtered);
    }

    case "TOGGLE_COLLAPSE": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const blockIndex = flatBlocks.findIndex((b) => b.id === blockId);

      if (blockIndex === -1) return blocks;

      const block = flatBlocks[blockIndex];

      if (block.children.length === 0) return blocks;

      const newBlock = {
        ...block,
        collapsed: !block.collapsed,
      };

      const newFlatBlocks = flatBlocks.slice();
      newFlatBlocks[blockIndex] = newBlock;

      return buildBlockTree(newFlatBlocks);
    }

    case "MERGE_WITH_PREVIOUS": {
      const { blockId } = action.payload;
      const previous = getPreviousBlock(blocks, blockId);

      if (!previous) return blocks;

      const flatBlocks = flattenBlocks(blocks);
      const currentBlock = flatBlocks.find((b) => b.id === blockId);

      if (!currentBlock) return blocks;

      // Merge content
      previous.content = previous.content + currentBlock.content;

      // Move children to previous block
      currentBlock.children.forEach((child) => {
        child.parent = previous;
        child.level = previous.level + 1;
        previous.children.push(child);
      });

      // Remove current block
      const filtered = flatBlocks.filter((b) => b.id !== blockId);
      return buildBlockTree(filtered);
    }

    case "SPLIT_BLOCK": {
      const { blockId, offset } = action.payload;
      debug.log("[blockReducer] SPLIT_BLOCK", {
        blockId,
        offset,
        blocksCountRoot: blocks.length,
        blocksCountAll: countAllBlocks(blocks),
      });
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1) return blocks;

      const block = flatBlocks[index];
      const content = block.content;

      // Split content at offset
      const beforeContent = content.slice(0, offset);
      const afterContent = content.slice(offset);

      debug.log("[blockReducer] SPLIT_BLOCK splitting", {
        beforeContent,
        afterContent,
      });

      // Create new blocks immutably
      const updatedBlock = { ...block, content: beforeContent };
      const newBlock = createBlock(afterContent, block.level);
      if (action.payload.newBlockId) {
        newBlock.id = action.payload.newBlockId;
      }

      // Create new flat array with updated block and new block
      const newFlatBlocks = [
        ...flatBlocks.slice(0, index),
        updatedBlock,
        newBlock,
        ...flatBlocks.slice(index + 1),
      ];

      const result = buildBlockTree(newFlatBlocks);
      debug.log("[blockReducer] SPLIT_BLOCK result", {
        newCountRoot: result.length,
        newCountAll: countAllBlocks(result),
        newBlockId: newBlock.id,
      });
      return result;
    }

    default:
      return blocks;
  }
}
