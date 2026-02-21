import { createWithEqualityFn } from "zustand/traditional";
import type { TodoStatus } from "../types/todo";
import {
  extractStatusPrefix,
  getNextStatus,
  setStatusPrefix,
} from "../types/todo";
import { useBlockStore } from "./blockStore";

interface TodoState {
  isLoading: boolean;
  error: string | null;
}

interface TodoActions {
  setTodoStatus: (blockId: string, status: TodoStatus) => Promise<void>;
  cycleTodoStatus: (blockId: string) => Promise<void>;
  removeTodoStatus: (blockId: string) => Promise<void>;
}

type TodoStore = TodoState & TodoActions;

export const useTodoStore = createWithEqualityFn<TodoStore>()((set) => ({
  isLoading: false,
  error: null,

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
}));
