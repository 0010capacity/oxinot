export interface ParsedBlockNode {
  content: string;
  indent: number;
  children: ParsedBlockNode[];
  lineNumber: number;
}

export function parseMarkdownToBlocks(markdown: string): ParsedBlockNode[] {
  const lines = markdown.split("\n");
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
  startIndex: number,
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
  parentBlockId: string | null = null,
): Array<FlattenedBlock & { sourceLineNumber: number }> {
  const result: Array<FlattenedBlock & { sourceLineNumber: number }> = [];
  let lastCreatedId: string | null = null;

  for (const node of nodes) {
    const tempBlockId = `temp_${Math.random().toString(36).substring(7)}`;

    result.push({
      content: node.content,
      parentBlockId,
      insertAfterBlockId: lastCreatedId,
      sourceLineNumber: node.lineNumber,
    });

    if (node.children.length > 0) {
      const childResults = flattenBlockHierarchy(node.children, tempBlockId);
      result.push(...childResults);
    }

    lastCreatedId = tempBlockId;
  }

  return result;
}
