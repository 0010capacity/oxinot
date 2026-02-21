/**
 * TODO/Task Management Type Definitions
 *
 * This module provides types and helper functions for the TODO functionality.
 * Status prefixes (TODO, DOING, DONE, LATER, CANCELED) are stored in block content
 * and extracted to metadata on save.
 */

/** Recognized TODO status values */
export type TodoStatus = "todo" | "doing" | "done" | "later" | "canceled";

/** Priority levels for TODO blocks */
export type Priority = "A" | "B" | "C";

/** Status prefixes recognized in block content (uppercase with trailing space) */
export const STATUS_PREFIXES: Record<string, TodoStatus> = {
  "TODO ": "todo",
  "DOING ": "doing",
  "DONE ": "done",
  "LATER ": "later",
  "CANCELED ": "canceled",
};

/** Reverse mapping: status → prefix string */
export const STATUS_TO_PREFIX: Record<TodoStatus, string> = {
  todo: "TODO ",
  doing: "DOING ",
  done: "DONE ",
  later: "LATER ",
  canceled: "CANCELED ",
};

/** Default click cycle (short cycle without LATER and CANCELED) */
export const STATUS_CYCLE: TodoStatus[] = ["todo", "doing", "done"];

/** All available statuses for context menu */
export const ALL_STATUSES: TodoStatus[] = [
  "todo",
  "doing",
  "done",
  "later",
  "canceled",
];

/** Status display names for UI */
export const STATUS_DISPLAY_NAMES: Record<TodoStatus, string> = {
  todo: "TODO",
  doing: "DOING",
  done: "DONE",
  later: "LATER",
  canceled: "CANCELED",
};

/**
 * Check if a block is a TODO block based on its metadata
 */
export function isTodoBlock(metadata?: Record<string, string>): boolean {
  return metadata?.todoStatus !== undefined;
}

/**
 * Get the TODO status from block metadata
 */
export function getTodoStatus(
  metadata?: Record<string, string>,
): TodoStatus | null {
  const status = metadata?.todoStatus;
  if (status && ALL_STATUSES.includes(status as TodoStatus)) {
    return status as TodoStatus;
  }
  return null;
}

/**
 * Extract status prefix from block content
 * Returns the status and the remaining content without the prefix
 */
export function extractStatusPrefix(
  content: string,
): { status: TodoStatus; rest: string } | null {
  for (const [prefix, status] of Object.entries(STATUS_PREFIXES)) {
    if (content.startsWith(prefix)) {
      return { status, rest: content.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Replace or add status prefix in content
 * If content already has a prefix, it's replaced; otherwise the new prefix is prepended
 */
export function setStatusPrefix(
  content: string,
  newStatus: TodoStatus,
): string {
  const extracted = extractStatusPrefix(content);
  const rest = extracted ? extracted.rest : content;
  return STATUS_TO_PREFIX[newStatus] + rest;
}

/**
 * Remove status prefix from content
 * Returns content without the prefix if one exists
 */
export function removeStatusPrefix(content: string): string {
  const extracted = extractStatusPrefix(content);
  return extracted ? extracted.rest : content;
}

/**
 * Get the next status in the cycle
 * Cycles through TODO → DOING → DONE → TODO
 */
export function getNextStatus(currentStatus: TodoStatus): TodoStatus {
  const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
  if (currentIndex === -1) {
    // If current status is not in cycle (e.g., LATER, CANCELED), start from TODO
    return "todo";
  }
  const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
}
