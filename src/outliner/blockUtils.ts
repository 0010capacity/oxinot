import { v4 as uuidv4 } from "uuid";
import { Block } from "./types";

export function generateBlockId(): string {
  return uuidv4();
}

export function createBlock(content: string = "", level: number = 0): Block {
  return {
    id: generateBlockId(),
    content,
    level,
    collapsed: false,
    children: [],
    parent: null,
    kind: "bullet",
  };
}

export function flattenBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];

  function traverse(block: Block) {
    result.push(block);
    block.children.forEach(traverse);
  }

  blocks.forEach(traverse);
  return result;
}

export function buildBlockTree(blocks: Block[]): Block[] {
  if (blocks.length === 0) return [];

  // Clear all children arrays first to prevent duplicates
  blocks.forEach((block) => {
    block.children = [];
    block.parent = null;
  });

  const root: Block[] = [];
  const stack: Block[] = [];

  for (const block of blocks) {
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

export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlockById(block.children, id);
    if (found) return found;
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
  currentId: string,
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

export function canIndent(blocks: Block[], blockId: string): boolean {
  const flat = flattenBlocks(blocks);
  const index = flat.findIndex((b) => b.id === blockId);
  if (index <= 0) return false;

  const current = flat[index];
  const previous = flat[index - 1];

  // Can only indent if previous block is at same level or higher
  return previous.level >= current.level;
}

export function canOutdent(block: Block): boolean {
  return block.level > 0;
}

export function hasChildren(block: Block): boolean {
  return block.children.length > 0;
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

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];

  // Brace block parsing state
  let inBraceBlock = false;
  let braceLevel = 0;
  let braceContentLines: string[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim() === "") continue;

    // Count leading spaces/tabs for indentation level
    const match = rawLine.match(/^(\s*)/);
    const indent = match ? match[1] : "";
    const level = Math.floor(indent.length / 2); // 2 spaces = 1 level

    const trimmedStart = rawLine.trimStart();
    const afterBullet = trimmedStart
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "");

    // Trigger open: any line whose content (after bullet) is exactly "{"
    const isBraceOpen = afterBullet.trim() === "{";
    // Trigger close: any line whose content (after bullet) is exactly "}"
    const isBraceClose = afterBullet.trim() === "}";

    if (!inBraceBlock) {
      if (isBraceOpen) {
        inBraceBlock = true;
        braceLevel = level;
        braceContentLines = [];

        const braceBlock = createBlock("", level);
        braceBlock.kind = "brace";
        braceBlock.braceState = "open";
        blocks.push(braceBlock);
        continue;
      }

      // Normal bullet block
      const content = afterBullet;
      blocks.push(createBlock(content, level));
      continue;
    }

    // We are inside a brace block
    if (isBraceClose && level === braceLevel) {
      // Close brace block and finalize content
      const last = blocks[blocks.length - 1];
      if (last) {
        last.content = braceContentLines.join("\n");
        last.braceState = "closed";
      }
      inBraceBlock = false;
      braceLevel = 0;
      braceContentLines = [];
      continue;
    }

    // Collect raw content line as-is (but remove leading indentation that would be represented by bullets)
    // We keep the line's text without the outer bullet prefix if present, so users can type plain text.
    braceContentLines.push(afterBullet);
  }

  // If document ends while a brace block is still open, auto-close it.
  // We do NOT allow unterminated brace blocks.
  if (inBraceBlock) {
    const last = blocks[blocks.length - 1];
    if (last) {
      last.content = braceContentLines.join("\n");
      last.braceState = "closed";
    }
    inBraceBlock = false;
    braceLevel = 0;
    braceContentLines = [];
  }

  return buildBlockTree(blocks);
}

export function blocksToMarkdown(
  blocks: Block[],
  includeCollapsed: boolean = true,
): string {
  const lines: string[] = [];

  function traverse(block: Block) {
    const indent = "  ".repeat(block.level);

    if (block.kind === "brace") {
      // Serialize brace blocks as:
      // - {
      //   (plain lines...)
      // - }
      lines.push(`${indent}- {`);

      const contentLines =
        block.content.length > 0 ? block.content.split("\n") : [];

      for (const contentLine of contentLines) {
        // Keep content as plain text inside the brace block (not outliner bullets).
        // We only indent by one outliner level (2 spaces) so the content remains "normal markdown"
        // when rendered inside the brace block.
        lines.push(`${indent}  ${contentLine}`);
      }

      lines.push(`${indent}- }`);
    } else {
      lines.push(`${indent}- ${block.content}`);
    }

    if (includeCollapsed || !block.collapsed) {
      block.children.forEach(traverse);
    }
  }

  blocks.forEach(traverse);
  return lines.join("\n");
}

export function cloneBlock(block: Block, deep: boolean = false): Block {
  const cloned = createBlock(block.content, block.level);
  cloned.collapsed = block.collapsed;

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
