/**
 * Node and state helper utilities
 *
 * This module provides utilities for working with CodeMirror's syntax tree,
 * editor state, and document structure. These helpers simplify common operations
 * like getting line information, cursor position, and node traversal.
 */

import type { EditorState, Line } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * Information about a line in the document
 */
export interface LineInfo {
  line: Line;
  text: string;
  from: number;
  to: number;
  number: number;
}

/**
 * Information about the cursor position
 */
export interface CursorInfo {
  pos: number;
  line: LineInfo;
  lineFrom: number;
  lineTo: number;
}

/**
 * Get line information for a given position
 */
export function getLineInfo(state: EditorState, pos: number): LineInfo {
  const line = state.doc.lineAt(pos);
  return {
    line,
    text: line.text,
    from: line.from,
    to: line.to,
    number: line.number,
  };
}

/**
 * Get information about the current cursor position
 */
export function getCursorInfo(state: EditorState): CursorInfo {
  const pos = state.selection.main.head;
  const lineInfo = getLineInfo(state, pos);

  return {
    pos,
    line: lineInfo,
    lineFrom: lineInfo.from,
    lineTo: lineInfo.to,
  };
}

/**
 * Get the text content of a node
 */
export function getNodeText(state: EditorState, node: SyntaxNode): string {
  return state.doc.sliceString(node.from, node.to);
}

/**
 * Check if a node is within the viewport
 */
export function isNodeInViewport(
  node: SyntaxNode,
  from: number,
  to: number,
): boolean {
  return node.from >= from && node.to <= to;
}

/**
 * Check if a node overlaps with a range
 */
export function nodeOverlapsRange(
  node: SyntaxNode,
  from: number,
  to: number,
): boolean {
  return node.from < to && node.to > from;
}

/**
 * Get the line containing a node
 */
export function getNodeLine(state: EditorState, node: SyntaxNode): LineInfo {
  return getLineInfo(state, node.from);
}

/**
 * Check if a node is on the cursor line
 */
export function isNodeOnCursorLine(
  state: EditorState,
  node: SyntaxNode,
  cursorLineFrom: number,
  cursorLineTo: number,
): boolean {
  const nodeLine = state.doc.lineAt(node.from);
  return nodeLine.from >= cursorLineFrom && nodeLine.to <= cursorLineTo;
}

/**
 * Find the start of content after markers (e.g., "# " -> content starts after space)
 */
export function findContentStart(
  text: string,
  markerPattern: RegExp,
): number | null {
  const match = text.match(markerPattern);
  if (!match) return null;
  return match[0].length;
}

/**
 * Extract marker and content from a line
 */
export interface MarkerContent {
  marker: string;
  markerEnd: number;
  content: string;
  contentStart: number;
  hasContent: boolean;
}

/**
 * Parse a line with a marker pattern (e.g., heading "# text")
 */
export function parseMarkerLine(
  lineText: string,
  markerPattern: RegExp,
): MarkerContent | null {
  const match = lineText.match(markerPattern);
  if (!match) return null;

  const marker = match[1] || match[0];
  const markerEnd = marker.length;
  const contentStart = match[0].length;
  const content = lineText.slice(contentStart);

  return {
    marker,
    markerEnd,
    content,
    contentStart,
    hasContent: content.length > 0,
  };
}

/**
 * Check if a line matches a pattern
 */
export function lineMatches(lineText: string, pattern: RegExp): boolean {
  return pattern.test(lineText);
}

/**
 * Get all lines in a range
 */
export function getLinesInRange(
  state: EditorState,
  from: number,
  to: number,
): LineInfo[] {
  const lines: LineInfo[] = [];
  let pos = from;

  while (pos <= to) {
    const lineInfo = getLineInfo(state, pos);
    lines.push(lineInfo);

    // Move to next line
    pos = lineInfo.to + 1;

    // Prevent infinite loop
    if (pos > state.doc.length) break;
  }

  return lines;
}

/**
 * Find all occurrences of a pattern in a line
 */
export interface PatternMatch {
  match: RegExpExecArray;
  from: number;
  to: number;
  text: string;
}

/**
 * Find all matches of a pattern in text
 */
export function findAllMatches(
  text: string,
  pattern: RegExp,
  offset = 0,
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );

  let match: RegExpExecArray | null;
  while ((match = globalPattern.exec(text)) !== null) {
    matches.push({
      match,
      from: offset + match.index,
      to: offset + match.index + match[0].length,
      text: match[0],
    });
  }

  return matches;
}

/**
 * Get child nodes of a given node
 */
export function getChildNodes(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  let child = node.firstChild;

  while (child) {
    children.push(child);
    child = child.nextSibling;
  }

  return children;
}

/**
 * Find a child node by type
 */
export function findChildByType(
  node: SyntaxNode,
  typeName: string,
): SyntaxNode | null {
  let child = node.firstChild;

  while (child) {
    if (child.type.name === typeName) {
      return child;
    }
    child = child.nextSibling;
  }

  return null;
}

/**
 * Find all child nodes by type
 */
export function findChildrenByType(
  node: SyntaxNode,
  typeName: string,
): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  let child = node.firstChild;

  while (child) {
    if (child.type.name === typeName) {
      children.push(child);
    }
    child = child.nextSibling;
  }

  return children;
}

/**
 * Check if position is at start of line
 */
export function isAtLineStart(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  return pos === line.from;
}

/**
 * Check if position is at end of line
 */
export function isAtLineEnd(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  return pos === line.to;
}

/**
 * Get the indentation level of a line (number of leading spaces/tabs)
 */
export function getIndentation(lineText: string): number {
  const match = lineText.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Strip leading/trailing whitespace from a string
 */
export function trimText(text: string): string {
  return text.trim();
}

/**
 * Check if text is empty or only whitespace
 */
export function isEmptyOrWhitespace(text: string): boolean {
  return text.trim().length === 0;
}
