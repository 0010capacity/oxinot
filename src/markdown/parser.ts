import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";

/**
 * Markdown block types that can be rendered inline
 */
export type MarkdownBlockType =
  | "Heading"
  | "Paragraph"
  | "CodeBlock"
  | "BlockQuote"
  | "List"
  | "ListItem"
  | "Task"
  | "HorizontalRule"
  | "Table";

/**
 * Inline markdown elements
 */
export type MarkdownInlineType =
  | "Emphasis"
  | "StrongEmphasis"
  | "InlineCode"
  | "Link"
  | "Image"
  | "Strikethrough";

/**
 * Parsed markdown block with position info
 */
export interface MarkdownBlock {
  type: MarkdownBlockType;
  from: number;
  to: number;
  content: string;
  level?: number; // For headings
  marker?: string; // For lists
  checked?: boolean; // For task items
  language?: string; // For code blocks
}

/**
 * Parsed inline element
 */
export interface MarkdownInline {
  type: MarkdownInlineType;
  from: number;
  to: number;
  content: string;
  url?: string; // For links/images
}

/**
 * Parse visible markdown blocks from editor state
 */
export function parseVisibleBlocks(
  state: EditorState,
  from: number,
  to: number,
): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    from,
    to,
    enter: (node) => {
      const { type, from, to } = node;
      const typeName = type.name;

      // Parse headings
      if (typeName.startsWith("ATXHeading")) {
        const level = parseInt(typeName.replace("ATXHeading", "")) || 1;
        blocks.push({
          type: "Heading",
          from,
          to,
          content: state.doc.sliceString(from, to),
          level,
        });
        return false;
      }

      // Parse code blocks
      if (typeName === "FencedCode") {
        const content = state.doc.sliceString(from, to);
        const languageMatch = content.match(/^```(\w+)?/);
        blocks.push({
          type: "CodeBlock",
          from,
          to,
          content,
          language: languageMatch?.[1] || "text",
        });
        return false;
      }

      // Parse task items
      if (typeName === "Task") {
        const content = state.doc.sliceString(from, to);
        const checked = /\[x\]/i.test(content);
        blocks.push({
          type: "Task",
          from,
          to,
          content,
          checked,
        });
        return false;
      }

      // Parse list items
      if (typeName === "ListItem") {
        const content = state.doc.sliceString(from, to);
        const marker = content.match(/^[\s]*([*\-+]|\d+\.)/)?.[1] || "-";

        // Check if it's a task list
        const taskMatch = content.match(/^[\s]*[*\-+]\s+\[([ x])\]/i);
        if (taskMatch) {
          blocks.push({
            type: "Task",
            from,
            to,
            content,
            checked: taskMatch[1].toLowerCase() === "x",
            marker,
          });
        } else {
          blocks.push({
            type: "ListItem",
            from,
            to,
            content,
            marker,
          });
        }
        return false;
      }

      // Parse blockquotes
      if (typeName === "Blockquote") {
        blocks.push({
          type: "BlockQuote",
          from,
          to,
          content: state.doc.sliceString(from, to),
        });
        return false;
      }

      // Parse horizontal rules
      if (typeName === "HorizontalRule") {
        blocks.push({
          type: "HorizontalRule",
          from,
          to,
          content: state.doc.sliceString(from, to),
        });
        return false;
      }

      return true;
    },
  });

  return blocks;
}

/**
 * Parse inline elements within a range
 */
export function parseInlineElements(
  state: EditorState,
  from: number,
  to: number,
): MarkdownInline[] {
  const inlines: MarkdownInline[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    from,
    to,
    enter: (node) => {
      const { type, from, to } = node;
      const typeName = type.name;
      const content = state.doc.sliceString(from, to);

      switch (typeName) {
        case "Emphasis":
          inlines.push({ type: "Emphasis", from, to, content });
          break;
        case "StrongEmphasis":
          inlines.push({ type: "StrongEmphasis", from, to, content });
          break;
        case "InlineCode":
          inlines.push({ type: "InlineCode", from, to, content });
          break;
        case "Link":
          const urlMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
          inlines.push({
            type: "Link",
            from,
            to,
            content: urlMatch?.[1] || content,
            url: urlMatch?.[2],
          });
          break;
        case "Image":
          const imgMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          inlines.push({
            type: "Image",
            from,
            to,
            content: imgMatch?.[1] || "",
            url: imgMatch?.[2],
          });
          break;
        case "Strikethrough":
          inlines.push({ type: "Strikethrough", from, to, content });
          break;
      }

      return true;
    },
  });

  return inlines;
}

/**
 * Check if a position is inside a markdown block
 */
export function getBlockAt(
  state: EditorState,
  pos: number,
): MarkdownBlock | null {
  const tree = syntaxTree(state);
  let result: MarkdownBlock | null = null;

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.from <= pos && pos <= node.to) {
        const blocks = parseVisibleBlocks(state, node.from, node.to);
        if (blocks.length > 0) {
          result = blocks[0];
        }
      }
      return node.from <= pos && pos <= node.to;
    },
  });

  return result;
}

/**
 * Get the line content at a specific position
 */
export function getLineContent(state: EditorState, pos: number): string {
  const line = state.doc.lineAt(pos);
  return line.text;
}

/**
 * Check if line is a heading
 */
export function isHeadingLine(line: string): {
  isHeading: boolean;
  level?: number;
  text?: string;
} {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (match) {
    return {
      isHeading: true,
      level: match[1].length,
      text: match[2],
    };
  }
  return { isHeading: false };
}

/**
 * Check if line is a task list item
 */
export function isTaskLine(line: string): {
  isTask: boolean;
  checked?: boolean;
  text?: string;
} {
  const match = line.match(/^[\s]*[*\-+]\s+\[([ xX])\]\s+(.*)$/);
  if (match) {
    return {
      isTask: true,
      checked: match[1].toLowerCase() === "x",
      text: match[2],
    };
  }
  return { isTask: false };
}

/**
 * Check if line is a list item
 */
export function isListLine(line: string): {
  isList: boolean;
  marker?: string;
  text?: string;
} {
  const match = line.match(/^[\s]*([*\-+]|\d+\.)\s+(.*)$/);
  if (match) {
    return {
      isList: true,
      marker: match[1],
      text: match[2],
    };
  }
  return { isList: false };
}
