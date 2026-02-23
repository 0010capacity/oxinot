/**
 * TODO Notification Service
 *
 * Monitors TODO items for due dates and displays notifications
 * for tasks due today and overdue tasks.
 */

import { emit } from "@tauri-apps/api/event";
import { useBlockStore } from "../../stores/blockStore";
import { usePageStore } from "../../stores/pageStore";
import {
  getDeadline,
  getScheduledDate,
  getTodoStatus,
  isOverdue,
} from "../../types/todo";
import type { TodoStatus } from "../../types/todo";

interface NotifiableTask {
  blockId: string;
  content: string;
  pageId: string;
  pageTitle: string;
  status: TodoStatus;
  dueDate: string; // ISO date string
  isOverdue: boolean;
}

/**
 * Get all TODO blocks across workspace
 */
function getAllTodoBlocks(): Map<
  string,
  { blockId: string; content: string; metadata?: Record<string, string> }
> {
  const blockStore = useBlockStore.getState();
  const todos = new Map();

  for (const [blockId, block] of Object.entries(blockStore.blocksById)) {
    const status = getTodoStatus(block.metadata);
    if (status && status !== "done" && status !== "canceled") {
      todos.set(blockId, block);
    }
  }

  return todos;
}

/**
 * Filter TODO blocks for those due today or overdue
 */
function filterNotifiableTasks(
  todoBlocks: Map<
    string,
    { blockId: string; content: string; metadata?: Record<string, string> }
  >,
): NotifiableTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split("T")[0];

  const pageStore = usePageStore.getState();
  const notifiable: NotifiableTask[] = [];

  for (const [blockId, block] of todoBlocks.entries()) {
    if (!block.metadata) continue;

    const status = getTodoStatus(block.metadata);
    if (!status || status === "done" || status === "canceled") continue;

    // Check for due date: prefer deadline, then scheduled date
    const deadline = getDeadline(block.metadata);
    const scheduled = getScheduledDate(block.metadata);
    const dueDate = deadline || scheduled;

    if (!dueDate) continue;

    // Only notify for tasks due today or overdue
    const dueDateIso = dueDate.split("T")[0];
    const overdue = isOverdue(block.metadata);

    if (dueDateIso !== todayIso && !overdue) continue;

    // Get page title for notification context
    const page = pageStore.pagesById[block.metadata.pageId || ""];
    const pageTitle = page?.title || "Unknown Page";

    notifiable.push({
      blockId,
      content: block.content,
      pageId: block.metadata.pageId || "",
      pageTitle,
      status,
      dueDate,
      isOverdue: overdue,
    });
  }

  return notifiable;
}

/**
 * Format notification message
 */
function formatNotificationMessage(tasks: NotifiableTask[]): {
  title: string;
  body: string;
} {
  if (tasks.length === 0) {
    return {
      title: "No pending tasks",
      body: "All tasks are on schedule",
    };
  }

  const overdueTasks = tasks.filter((t) => t.isOverdue);
  const dueTodayTasks = tasks.filter((t) => !t.isOverdue);

  let title: string;
  let body: string;

  if (overdueTasks.length > 0 && dueTodayTasks.length > 0) {
    title = `${tasks.length} tasks need attention`;
    const overdueText = `${overdueTasks.length} overdue`;
    const dueTodayText = `${dueTodayTasks.length} due today`;
    body = `${overdueText}, ${dueTodayText}`;
  } else if (overdueTasks.length > 0) {
    title = `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task" : "tasks"}`;
    body = overdueTasks.map((t) => `• ${t.content.slice(0, 50)}`).join("\n");
  } else {
    title = `${dueTodayTasks.length} ${dueTodayTasks.length === 1 ? "task" : "tasks"} due today`;
    body = dueTodayTasks.map((t) => `• ${t.content.slice(0, 50)}`).join("\n");
  }

  return { title, body };
}

/**
 * Send notification via Tauri
 * This emits to the frontend notification system
 */
async function sendNotification(title: string, body: string): Promise<void> {
  try {
    // Emit to frontend notification system
    await emit("todo-notification", { title, body });
  } catch (error) {
    console.error("[todoNotifications] Failed to send notification:", error);
  }
}

/**
 * Show notifications for TODO items due today or overdue
 * Called on app launch or periodic check
 */
export async function checkAndNotifyDueTasks(): Promise<void> {
  try {
    console.log("[todoNotifications] Checking for due tasks...");

    const todoBlocks = getAllTodoBlocks();
    if (todoBlocks.size === 0) {
      console.log("[todoNotifications] No active TODO blocks found");
      return;
    }

    const notifiable = filterNotifiableTasks(todoBlocks);
    if (notifiable.length === 0) {
      console.log("[todoNotifications] No tasks due today or overdue");
      return;
    }

    const { title, body } = formatNotificationMessage(notifiable);
    await sendNotification(title, body);

    console.log(
      `[todoNotifications] Notified for ${notifiable.length} task(s)`,
    );
  } catch (error) {
    console.error("[todoNotifications] Error checking tasks:", error);
  }
}

/**
 * Initialize periodic notification checks
 * Currently checks on app launch only; periodic polling can be added in Phase 5
 */
export function initializeTodoNotifications(): void {
  // Check on app startup
  checkAndNotifyDueTasks().catch((error) => {
    console.error("[todoNotifications] Initial check failed:", error);
  });
}
