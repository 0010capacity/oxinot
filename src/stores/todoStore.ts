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

interface TodoActions {
  setTodoStatus: (blockId: string, status: TodoStatus) => Promise<void>;
  cycleTodoStatus: (blockId: string) => Promise<void>;
  removeTodoStatus: (blockId: string) => Promise<void>;
  fetchTodos: (filter: TodoFilter) => Promise<void>;
  fetchSmartView: (viewId: string) => Promise<void>;
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

  clearCache: () => {
    set({ todos: [], lastFetch: null });
  },
}));
