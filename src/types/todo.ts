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

// ============================================
// Priority Helpers (Phase 2)
// ============================================

/** Priority display names */
export const PRIORITY_DISPLAY_NAMES: Record<Priority, string> = {
  A: "High",
  B: "Medium",
  C: "Low",
};

/** All priority levels */
export const ALL_PRIORITIES: Priority[] = ["A", "B", "C"];

/**
 * Get the priority from block metadata
 */
export function getPriority(
  metadata?: Record<string, string>,
): Priority | null {
  const priority = metadata?.priority;
  if (priority && ALL_PRIORITIES.includes(priority as Priority)) {
    return priority as Priority;
  }
  return null;
}

/**
 * Check if a TODO is overdue (deadline < today and not completed)
 */
export function isOverdue(metadata?: Record<string, string>): boolean {
  const status = getTodoStatus(metadata);
  if (!status || status === "done" || status === "canceled") {
    return false;
  }
  const deadline = metadata?.deadline;
  if (!deadline) {
    return false;
  }
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

/**
 * Get scheduled date from metadata
 */
export function getScheduledDate(
  metadata?: Record<string, string>,
): string | null {
  return metadata?.scheduled || null;
}

/**
 * Get deadline from metadata
 */
export function getDeadline(metadata?: Record<string, string>): string | null {
  return metadata?.deadline || null;
}

/**
 * Format date for display (e.g., "Mar 15" or "3월 15일")
 */
export function formatDateForDisplay(
  isoDate: string,
  locale: "en" | "ko" = "en",
): string {
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check for today/tomorrow/yesterday
  if (date.toDateString() === today.toDateString()) {
    return locale === "ko" ? "오늘" : "Today";
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return locale === "ko" ? "내일" : "Tomorrow";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return locale === "ko" ? "어제" : "Yesterday";
  }

  // Format as "Mar 15" or "3월 15일"
  if (locale === "ko") {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================
// Smart View Filter Types (Phase 2)
// ============================================

/** Smart view types */
export type SmartViewType =
  | "today"
  | "upcoming"
  | "overdue"
  | "high_priority"
  | "all"
  | "completed";

/** Smart view configuration */
export interface SmartView {
  id: SmartViewType;
  label: string;
  labelKo: string;
  /** Tabler icon name for this view */
  iconName:
    | "IconCalendar"
    | "IconCalendarPlus"
    | "IconAlertTriangle"
    | "IconFlag"
    | "IconList"
    | "IconCheck";
  filter: TodoFilter;
}

/** Filter options for TODO queries */
export interface TodoFilter {
  status?: TodoStatus[];
  priority?: Priority[];
  scheduledFrom?: string; // ISO date
  scheduledTo?: string; // ISO date
  deadlineFrom?: string; // ISO date
  deadlineTo?: string; // ISO date
  overdueOnly?: boolean;
  pageId?: string;
}

/** Pre-defined smart views */
export const SMART_VIEWS: SmartView[] = [
  {
    id: "today",
    label: "Today",
    labelKo: "오늘",
    iconName: "IconCalendar",
    filter: {
      status: ["todo", "doing"],
      scheduledFrom: new Date().toISOString().split("T")[0],
      scheduledTo: new Date().toISOString().split("T")[0],
    },
  },
  {
    id: "upcoming",
    label: "Upcoming",
    labelKo: "다가오는 일정",
    iconName: "IconCalendarPlus",
    filter: {
      status: ["todo", "doing"],
      scheduledFrom: new Date().toISOString().split("T")[0],
    },
  },
  {
    id: "overdue",
    label: "Overdue",
    labelKo: "기한 초과",
    iconName: "IconAlertTriangle",
    filter: {
      status: ["todo", "doing"],
      overdueOnly: true,
    },
  },
  {
    id: "high_priority",
    label: "High Priority",
    labelKo: "높은 우선순위",
    iconName: "IconFlag",
    filter: {
      status: ["todo", "doing"],
      priority: ["A"],
    },
  },
  {
    id: "all",
    label: "All Tasks",
    labelKo: "모든 작업",
    iconName: "IconList",
    filter: {
      status: ["todo", "doing", "later"],
    },
  },
  {
    id: "completed",
    label: "Completed",
    labelKo: "완료됨",
    iconName: "IconCheck",
    filter: {
      status: ["done"],
    },
  },
];

/** Result from a TODO query */
export interface TodoResult {
  blockId: string;
  content: string;
  pageId: string;
  pageTitle: string;
  status: TodoStatus;
  scheduled?: string;
  deadline?: string;
  priority?: Priority;
}
