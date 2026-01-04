import { Block, BlockAction } from "./types";
import {
  createBlock,
  flattenBlocks,
  buildBlockTree,
  findBlockById,
  canIndent,
  canOutdent,
  cloneBlock,
  getPreviousBlock,
  getNextBlock,
} from "./blockUtils";

export function blockReducer(blocks: Block[], action: BlockAction): Block[] {
  switch (action.type) {
    case "ADD_BLOCK": {
      const { afterBlockId, level } = action.payload;
      const flatBlocks = flattenBlocks(blocks);

      if (!afterBlockId) {
        // Add at the end
        const newBlock = createBlock("", level ?? 0);
        return buildBlockTree([...flatBlocks, newBlock]);
      }

      const index = flatBlocks.findIndex((b) => b.id === afterBlockId);
      if (index === -1) return blocks;

      const currentBlock = flatBlocks[index];
      const newBlock = createBlock("", level ?? currentBlock.level);

      flatBlocks.splice(index + 1, 0, newBlock);
      return buildBlockTree(flatBlocks);
    }

    case "DELETE_BLOCK": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1) return blocks;

      const block = flatBlocks[index];

      // Remove block and all its children
      const toRemove = new Set([block.id]);
      function markChildren(b: Block) {
        b.children.forEach((child) => {
          toRemove.add(child.id);
          markChildren(child);
        });
      }
      markChildren(block);

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
      function increaseChildrenLevel(b: Block) {
        b.children.forEach((child) => {
          child.level += 1;
          increaseChildrenLevel(child);
        });
      }
      increaseChildrenLevel(block);

      return buildBlockTree(flatBlocks);
    }

    case "OUTDENT_BLOCK": {
      const { blockId } = action.payload;
      const flatBlocks = flattenBlocks(blocks);
      const block = flatBlocks.find((b) => b.id === blockId);

      if (!block || !canOutdent(block)) return blocks;

      block.level = Math.max(0, block.level - 1);

      // Also decrease level of all descendants
      function decreaseChildrenLevel(b: Block) {
        b.children.forEach((child) => {
          child.level = Math.max(0, child.level - 1);
          decreaseChildrenLevel(child);
        });
      }
      decreaseChildrenLevel(block);

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
      const descendants: Block[] = [];
      function collectDescendants(b: Block) {
        b.children.forEach((child) => {
          descendants.push(child);
          collectDescendants(child);
        });
      }
      collectDescendants(block);

      // Collect all descendants of previous block
      const previousDescendants: Block[] = [];
      collectDescendants(previous);

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
      const descendants: Block[] = [];
      function collectDescendants(b: Block) {
        b.children.forEach((child) => {
          descendants.push(child);
          collectDescendants(child);
        });
      }
      collectDescendants(block);

      // Collect all descendants of next sibling
      const nextDescendants: Block[] = [];
      collectDescendants(nextSibling);

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
      const flatBlocks = flattenBlocks(blocks);
      const index = flatBlocks.findIndex((b) => b.id === blockId);

      if (index === -1) return blocks;

      const block = flatBlocks[index];
      const content = block.content;

      // Split content at offset
      const beforeContent = content.slice(0, offset);
      const afterContent = content.slice(offset);

      // Update current block
      block.content = beforeContent;

      // Create new block with remaining content
      const newBlock = createBlock(afterContent, block.level);

      // Insert new block after current
      flatBlocks.splice(index + 1, 0, newBlock);

      return buildBlockTree(flatBlocks);
    }

    default:
      return blocks;
  }
}
