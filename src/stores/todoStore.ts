import { invoke } from "@tauri-apps/api/core";
import { createWithEqualityFn } from "zustand/traditional";
import type { TodoFilter, TodoResult, TodoStatus } from "../types/todo";
import {
  SMART_VIEWS,
  extractStatusPrefix,
  getNextStatus,
  setStatusPrefix,
} from "../types/todo";
import { useBlockStore } from "./blockStore";
import { useWorkspaceStore } from "./workspaceStore";

interface TodoState {
  isLoading: boolean;
  error: string | null;
  todos: TodoResult[];
  lastFetch: number | null;
}

interface TodoStatistics {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

interface TodoActions {
  setTodoStatus: (blockId: string, status: TodoStatus) => Promise<void>;
  cycleTodoStatus: (blockId: string) => Promise<void>;
  removeTodoStatus: (blockId: string) => Promise<void>;
  bulkUpdateStatus: (blockIds: string[], status: TodoStatus) => Promise<void>;
  fetchTodos: (filter: TodoFilter) => Promise<void>;
  fetchSmartView: (viewId: string) => Promise<void>;
  fetchStatistics: () => Promise<TodoStatistics>;
  clearCache: () => void;
}

type TodoStore = TodoState & TodoActions;

export const useTodoStore = createWithEqualityFn<TodoStore>()((set, get) => ({
  isLoading: false,
  error: null,
  todos: [],
  lastFetch: null,

  setTodoStatus: async (blockId: string, status: TodoStatus) => {
    try {
      set({ isLoading: true, error: null });

      const blockStore = useBlockStore.getState();
      const block = blockStore.blocksById[blockId];

      if (!block) {
        throw new Error(`Block not found: ${blockId}`);
      }

      const content = block.content || "";
      const extracted = extractStatusPrefix(content);
      const rest = extracted ? extracted.rest : content;
      const newContent = setStatusPrefix(rest, status);

      await blockStore.updateBlockContent(blockId, newContent);

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[todoStore] setTodoStatus error:", message);
      set({ isLoading: false, error: message });
    }
  },

  cycleTodoStatus: async (blockId: string) => {
    try {
      set({ isLoading: true, error: null });

      const blockStore = useBlockStore.getState();
      const block = blockStore.blocksById[blockId];

      if (!block) {
        throw new Error(`Block not found: ${blockId}`);
      }

      const content = block.content || "";
      const extracted = extractStatusPrefix(content);

      let nextStatus: TodoStatus;
      let rest: string;

      if (extracted) {
        nextStatus = getNextStatus(extracted.status);
        rest = extracted.rest;
      } else {
        nextStatus = "todo";
        rest = content;
      }

      const newContent = setStatusPrefix(rest, nextStatus);
      await blockStore.updateBlockContent(blockId, newContent);

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[todoStore] cycleTodoStatus error:", message);
      set({ isLoading: false, error: message });
    }
  },

  removeTodoStatus: async (blockId: string) => {
    try {
      set({ isLoading: true, error: null });

      const blockStore = useBlockStore.getState();
      const block = blockStore.blocksById[blockId];

      if (!block) {
        throw new Error(`Block not found: ${blockId}`);
      }

      const content = block.content || "";
      const extracted = extractStatusPrefix(content);

      if (extracted) {
        await blockStore.updateBlockContent(blockId, extracted.rest);
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[todoStore] removeTodoStatus error:", message);
      set({ isLoading: false, error: message });
    }
  },

  bulkUpdateStatus: async (blockIds: string[], status: TodoStatus) => {
    try {
      set({ isLoading: true, error: null });

      const blockStore = useBlockStore.getState();

      for (const blockId of blockIds) {
        const block = blockStore.blocksById[blockId];
        if (!block) continue;

        const content = block.content || "";
        const extracted = extractStatusPrefix(content);
        const rest = extracted ? extracted.rest : content;
        const newContent = setStatusPrefix(rest, status);

        await blockStore.updateBlockContent(blockId, newContent);
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[todoStore] bulkUpdateStatus error:", message);
      set({ isLoading: false, error: message });
    }
  },

  fetchTodos: async (filter: TodoFilter) => {
    try {
      set({ isLoading: true, error: null });

      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        throw new Error("No workspace selected");
      }

      const todos = await invoke<TodoResult[]>("query_todos", {
        workspacePath,
        filter,
      });

      set({ todos, lastFetch: Date.now(), isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[todoStore] fetchTodos error:", message);
      set({ isLoading: false, error: message });
    }
  },

  fetchSmartView: async (viewId: string) => {
    const smartView = SMART_VIEWS.find((v) => v.id === viewId);
    if (!smartView) {
      console.error("[todoStore] Unknown smart view:", viewId);
      return;
    }
    await get().fetchTodos(smartView.filter);
  },

  fetchStatistics: async (): Promise<TodoStatistics> => {
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        completionRate: 0,
      };
    }

    try {
      // Fetch all todos for statistics
      const allTodos = await invoke<TodoResult[]>("query_todos", {
        workspacePath,
        filter: {},
      });

      const total = allTodos.length;
      const completed = allTodos.filter((t) => t.status === "done").length;
      const inProgress = allTodos.filter((t) => t.status === "doing").length;

      // Fetch overdue count
      const overdueTodos = await invoke<TodoResult[]>("query_todos", {
        workspacePath,
        filter: { overdueOnly: true, status: ["todo", "doing", "later"] },
      });
      const overdue = overdueTodos.length;

      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        completed,
        inProgress,
        overdue,
        completionRate,
      };
    } catch (error) {
      console.error("[todoStore] fetchStatistics error:", error);
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        completionRate: 0,
      };
    }
  },

  clearCache: () => {
    set({ todos: [], lastFetch: null });
  },
}));

export type { TodoStatistics };
