import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { TodoResult } from "../../../../types/todo";
import type { Tool, ToolResult } from "../types";

export const queryTodosTool: Tool = {
  name: "query_todos",
  description:
    "Search and filter TODO blocks across the workspace. Returns matching tasks with their content, status, dates, and priority. Use this to answer questions like 'what are my tasks today?' or 'show me high priority items'.",
  category: "metadata",
  requiresApproval: false, // Read-only

  parameters: z.object({
    status: z
      .array(z.enum(["todo", "doing", "done", "later", "canceled"]))
      .optional()
      .describe(
        "Filter by status values. Example: ['todo', 'doing'] for active tasks.",
      ),
    priority: z
      .array(z.enum(["A", "B", "C"]))
      .optional()
      .describe("Filter by priority. A=High, B=Medium, C=Low."),
    dateRange: z
      .enum(["today", "this_week", "overdue", "upcoming"])
      .optional()
      .describe(
        "Pre-defined date ranges: today=scheduled for today, this_week=next 7 days, overdue=past deadline, upcoming=has scheduled date",
      ),
    query: z.string().optional().describe("Full-text search in task content."),
    pageId: z.string().uuid().optional().describe("Filter to specific page."),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(30)
      .describe("Maximum results. Default 30."),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // Build filter object for Rust backend
      const filter: Record<string, unknown> = {
        limit: params.limit,
      };

      if (params.status) {
        filter.status = params.status;
      }

      if (params.priority) {
        filter.priority = params.priority;
      }

      if (params.pageId) {
        filter.pageId = params.pageId;
      }

      // Handle date range presets
      if (params.dateRange) {
        const today = new Date().toISOString().split("T")[0];

        switch (params.dateRange) {
          case "today":
            filter.scheduledFrom = today;
            filter.scheduledTo = today;
            break;
          case "this_week": {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() + 7);
            filter.scheduledFrom = today;
            filter.scheduledTo = weekEnd.toISOString().split("T")[0];
            break;
          }
          case "overdue":
            filter.overdueOnly = true;
            // Exclude done and canceled from overdue
            if (!filter.status) {
              filter.status = ["todo", "doing", "later"];
            }
            break;
          case "upcoming":
            filter.scheduledFrom = today;
            // No end date - all future scheduled tasks
            break;
        }
      }

      // Add full-text query if provided
      if (params.query) {
        filter.query = params.query;
      }

      const todos = await invoke<TodoResult[]>("query_todos", {
        workspacePath: context.workspacePath,
        filter,
      });

      // Format response for AI consumption
      const formattedTodos = todos.map((todo) => ({
        blockId: todo.blockId,
        content: todo.content,
        pageId: todo.pageId,
        pageTitle: todo.pageTitle,
        status: todo.status,
        scheduled: todo.scheduled,
        deadline: todo.deadline,
        priority: todo.priority,
      }));

      return {
        success: true,
        data: formattedTodos,
        metadata: {
          count: formattedTodos.length,
          hasStatusFilter: !!params.status,
          hasPriorityFilter: !!params.priority,
          hasDateRangeFilter: !!params.dateRange,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query TODOs",
      };
    }
  },
};
