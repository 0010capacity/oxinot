import { v4 as uuidv4 } from "uuid";
import {
  BLOCK_KINDS,
  CODE_MARKERS,
  FENCE_MARKERS,
  INDENT_SIZE,
  MAX_LEVEL,
  MIN_LEVEL,
} from "./constants";
import { debug } from "./debug";
import type { Block } from "./types";

/**
 * Generate a unique block ID
 */
export function generateBlockId(): string {
  return uuidv4();
}

/**
 * Create a new block with validation
 */
export function createBlock(content = "", level = 0): Block {
  // Validate and clamp level
  const clampedLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));

  if (level !== clampedLevel) {
    debug.warn(`Block level ${level} clamped to ${clampedLevel}`);
  }

  return {
    id: generateBlockId(),
    content,
    level: clampedLevel,
    collapsed: false,
    children: [],
    parent: null,
    kind: BLOCK_KINDS.BULLET as "bullet",
  };
}

/**
 * Flatten a tree of blocks into a flat array (depth-first)
 */
export function flattenBlocks(blocks: Block[]): Block[] {
  if (!Array.isArray(blocks)) {
    debug.error("flattenBlocks: blocks is not an array", blocks);
    return [];
  }

  const result: Block[] = [];

  function traverse(block: Block) {
    if (!block || typeof block !== "object") {
      debug.warn("flattenBlocks: invalid block encountered", block);
      return;
    }
    result.push(block);
    if (Array.isArray(block.children)) {
      block.children.forEach(traverse);
    }
  }

  blocks.forEach(traverse);
  return result;
}

/**
 * Build a tree structure from a flat array of blocks
 */
export function buildBlockTree(blocks: Block[]): Block[] {
  if (!Array.isArray(blocks)) {
    debug.error("buildBlockTree: blocks is not an array", blocks);
    return [];
  }

  if (blocks.length === 0) return [];

  // Reset children and parent references to rebuild tree structure
  for (const block of blocks) {
    if (block) {
      block.children = [];
      block.parent = null;
    }
  }

  const root: Block[] = [];
  const stack: Block[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      debug.warn("buildBlockTree: invalid block encountered", block);
      continue;
    }

    // Pop stack until we find the appropriate parent
    while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Root level block
      block.parent = null;
      root.push(block);
    } else {
      // Child block
      const parent = stack[stack.length - 1];
      block.parent = parent;
      parent.children.push(block);
    }

    stack.push(block);
  }

  return root;
}

/**
 * Find a block by ID in a tree structure
 */
export function findBlockById(blocks: Block[], id: string): Block | null {
  if (!Array.isArray(blocks) || !id) {
    debug.warn("findBlockById: invalid input", { blocks, id });
    return null;
  }

  for (const block of blocks) {
    if (!block) continue;
    if (block.id === id) return block;
    if (Array.isArray(block.children)) {
      const found = findBlockById(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findBlockIndex(blocks: Block[], id: string): number {
  return blocks.findIndex((block) => block.id === id);
}

export function getBlockPath(block: Block): Block[] {
  const path: Block[] = [];
  let current: Block | null = block;

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

export function getPreviousBlock(
  blocks: Block[],
  currentId: string
): Block | null {
  const flat = flattenBlocks(blocks);
  const index = flat.findIndex((b) => b.id === currentId);
  return index > 0 ? flat[index - 1] : null;
}

export function getNextBlock(blocks: Block[], currentId: string): Block | null {
  const flat = flattenBlocks(blocks);
  const index = flat.findIndex((b) => b.id === currentId);
  return index >= 0 && index < flat.length - 1 ? flat[index + 1] : null;
}

/**
 * Check if a block can be indented
 */
export function canIndent(blocks: Block[], blockId: string): boolean {
  if (!Array.isArray(blocks) || !blockId) return false;

  const flat = flattenBlocks(blocks);
  const index = flat.findIndex((b) => b.id === blockId);
  if (index <= 0) return false;

  const current = flat[index];
  const previous = flat[index - 1];

  if (!current || !previous) return false;

  // Can only indent if previous block is at same level or higher
  // and we haven't reached max level
  return previous.level >= current.level && current.level < MAX_LEVEL;
}

/**
 * Check if a block can be outdented
 */
export function canOutdent(block: Block): boolean {
  if (!block) return false;
  return block.level > MIN_LEVEL;
}

/**
 * Check if a block has children
 */
export function hasChildren(block: Block): boolean {
  return block && Array.isArray(block.children) && block.children.length > 0;
}

export function isFirstChild(block: Block): boolean {
  if (!block.parent) return false;
  return block.parent.children[0]?.id === block.id;
}

export function isLastChild(block: Block): boolean {
  if (!block.parent) return false;
  const siblings = block.parent.children;
  return siblings[siblings.length - 1]?.id === block.id;
}

export function getSiblings(block: Block): Block[] {
  if (!block.parent) return [];
  return block.parent.children;
}

export function getVisibleDescendantCount(block: Block): number {
  if (block.collapsed) return 0;

  let count = block.children.length;
  for (const child of block.children) {
    count += getVisibleDescendantCount(child);
  }

  return count;
}

/**
 * Convert block tree to markdown text
 */
export function blocksToMarkdown(
  blocks: Block[],
  includeCollapsed = true
): string {
  if (!Array.isArray(blocks)) {
    debug.error("blocksToMarkdown: blocks is not an array", blocks);
    return "";
  }

  const lines: string[] = [];

  const traverse = (block: Block) => {
    if (!block || typeof block !== "object") {
      debug.warn("blocksToMarkdown: invalid block encountered", block);
      return;
    }

    const indent = " ".repeat(block.level * INDENT_SIZE);

    if (block.kind === BLOCK_KINDS.CODE) {
      // Serialize code blocks as:
      // - ```language
      //   (code lines...)
      // - ```
      const languageTag = block.language ? block.language : "";
      lines.push(`${indent}- ${CODE_MARKERS.FENCE}${languageTag}`);

      const contentLines =
        block.content.length > 0 ? block.content.split("\n") : [];

      for (const contentLine of contentLines) {
        lines.push(`${indent}${" ".repeat(INDENT_SIZE)}${contentLine}`);
      }

      lines.push(`${indent}- ${CODE_MARKERS.FENCE}`);
    } else if (block.kind === BLOCK_KINDS.FENCE) {
      // Serialize fence blocks as:
      // - ///
      //   (plain lines...)
      // - ///
      lines.push(`${indent}- ${FENCE_MARKERS.DELIMITER}`);

      const contentLines =
        block.content.length > 0 ? block.content.split("\n") : [];

      for (const contentLine of contentLines) {
        lines.push(`${indent}${" ".repeat(INDENT_SIZE)}${contentLine}`);
      }

      lines.push(`${indent}- ${FENCE_MARKERS.DELIMITER}`);
    } else {
      lines.push(`${indent}- ${block.content}`);
    }

    if (
      (includeCollapsed || !block.collapsed) &&
      Array.isArray(block.children)
    ) {
      block.children.forEach(traverse);
    }
  };

  try {
    blocks.forEach(traverse);
    return lines.join("\n");
  } catch (error) {
    debug.error("blocksToMarkdown: serialization error", error);
    return "";
  }
}

export function cloneBlock(block: Block, deep = false): Block {
  const cloned = createBlock(block.content, block.level);
  cloned.collapsed = block.collapsed;
  cloned.kind = block.kind;
  cloned.language = block.language;
  cloned.fenceState = block.fenceState;

  if (deep) {
    cloned.children = block.children.map((child) => {
      const clonedChild = cloneBlock(child, true);
      clonedChild.parent = cloned;
      return clonedChild;
    });
  }

  return cloned;
}

export function getAllBlockIds(blocks: Block[]): string[] {
  const ids: string[] = [];

  function traverse(block: Block) {
    ids.push(block.id);
    block.children.forEach(traverse);
  }

  blocks.forEach(traverse);
  return ids;
}

export function getBlockDepth(block: Block): number {
  let depth = 0;
  let current: Block | null = block;

  while (current.parent) {
    depth++;
    current = current.parent;
  }

  return depth;
}
