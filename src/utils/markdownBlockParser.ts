export interface ParsedBlockNode {
  content: string;
  indent: number;
  children: ParsedBlockNode[];
  lineNumber: number;
}

/**
 * Normalize markdown indentation to fix common AI spacing issues.
 * AI models often generate "- Item\n - SubItem" (1 space) instead of "- Item\n  - SubItem" (2 spaces).
 * This function detects and corrects these patterns.
 */
function normalizeMarkdownIndentation(markdown: string): string {
  const lines = markdown.split("\n");
  const normalized: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      normalized.push(line);
      continue;
    }

    // Match bullet list items with leading whitespace
    const match = line.match(/^(\s*)([*\-+])\s+(.*)$/);
    if (!match) {
      normalized.push(line);
      continue;
    }

    const [, leadingWhitespace, bullet, content] = match;
    const spaceCount = leadingWhitespace.length;

    // If odd number of spaces (1, 3, 5, etc.), normalize to even (2, 4, 6, etc.)
    // This fixes AI's common mistake of using 1 space instead of 2
    if (spaceCount % 2 === 1 && spaceCount > 0) {
      const normalizedSpaces = spaceCount + 1;
      normalized.push(`${" ".repeat(normalizedSpaces)}${bullet} ${content}`);
      console.log(
        `[markdownBlockParser] Normalized indent: ${spaceCount} spaces → ${normalizedSpaces} spaces for line: "${content.substring(
          0,
          40
        )}..."`
      );
    } else {
      normalized.push(line);
    }
  }

  return normalized.join("\n");
}

export function parseMarkdownToBlocks(markdown: string): ParsedBlockNode[] {
  // Normalize indentation before parsing
  const normalizedMarkdown = normalizeMarkdownIndentation(markdown);

  const lines = normalizedMarkdown.split("\n");
  const parsedLines: Array<{
    content: string;
    indent: number;
    lineNumber: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) continue;

    const match = line.match(/^(\s*)([*\-+])\s+(.*)$/);
    if (!match) {
      continue;
    }

    const [, leadingWhitespace, , content] = match;
    const spaceCount = leadingWhitespace.length;
    const indent = Math.floor(spaceCount / 2);

    parsedLines.push({
      content: content.trim(),
      indent,
      lineNumber: i,
    });
  }

  const result = buildHierarchyImpl(parsedLines, -1, 0);
  return result.nodes;
}

interface HierarchyResult {
  nodes: ParsedBlockNode[];
  nextIndex: number;
}

function buildHierarchyImpl(
  items: Array<{ content: string; indent: number; lineNumber: number }>,
  parentIndent: number,
  startIndex: number
): HierarchyResult {
  const result: ParsedBlockNode[] = [];
  let i = startIndex;

  while (i < items.length) {
    const item = items[i];

    if (item.indent === parentIndent + 1) {
      const node: ParsedBlockNode = {
        content: item.content,
        indent: item.indent,
        children: [],
        lineNumber: item.lineNumber,
      };

      i++;

      const childrenResult = buildHierarchyImpl(items, item.indent, i);
      node.children = childrenResult.nodes;
      i = childrenResult.nextIndex;

      result.push(node);
    } else if (item.indent > parentIndent + 1) {
      i += 1;
    } else {
      break;
    }
  }

  return { nodes: result, nextIndex: i };
}

export interface FlattenedBlock {
  content: string;
  parentBlockId: string | null;
  insertAfterBlockId?: string | null;
}

export function flattenBlockHierarchy(
  nodes: ParsedBlockNode[],
  parentBlockId: string | null = null
): Array<FlattenedBlock & { sourceLineNumber: number }> {
  const result: Array<FlattenedBlock & { sourceLineNumber: number }> = [];
  let lastSiblingId: string | null = null;

  for (const node of nodes) {
    const tempBlockId = `temp_${Math.random().toString(36).substring(7)}`;

    result.push({
      content: node.content,
      parentBlockId,
      insertAfterBlockId: lastSiblingId,
      sourceLineNumber: node.lineNumber,
    });

    if (node.children.length > 0) {
      const childResults = flattenBlockHierarchy(node.children, tempBlockId);
      result.push(...childResults);
    }

    lastSiblingId = tempBlockId;
  }

  return result;
}
