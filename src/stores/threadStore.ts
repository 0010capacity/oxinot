import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ThreadStatus = "pending" | "streaming" | "complete" | "error";

export interface AIThread {
  id: string;
  promptBlockId: string;
  responseBlockId: string | null;
  status: ThreadStatus;
  streamContent: string;
  error: string | null;
  model: string;
  provider: string;
  abortController: AbortController | null;
}

interface ThreadState {
  activeThreads: Record<string, AIThread>;
}

interface ThreadActions {
  startThread: (
    promptBlockId: string,
    model: string,
    provider: string,
  ) => string;
  setResponseBlock: (threadId: string, blockId: string) => void;
  appendStreamContent: (threadId: string, chunk: string) => void;
  setStreamContent: (threadId: string, content: string) => void;
  completeThread: (threadId: string) => void;
  failThread: (threadId: string, error: string) => void;
  cancelThread: (threadId: string) => void;
  removeThread: (threadId: string) => void;
  getThread: (threadId: string) => AIThread | undefined;
  getThreadByPromptBlock: (blockId: string) => AIThread | undefined;
  getThreadByResponseBlock: (blockId: string) => AIThread | undefined;
}

type ThreadStore = ThreadState & ThreadActions;

export const useThreadStore = create<ThreadStore>()(
  immer((set, get) => ({
    activeThreads: {},

    startThread: (promptBlockId, model, provider) => {
      const threadId = `thread_${uuidv4()}`;
      const thread: AIThread = {
        id: threadId,
        promptBlockId,
        responseBlockId: null,
        status: "pending",
        streamContent: "",
        error: null,
        model,
        provider,
        abortController: new AbortController(),
      };

      set((state) => {
        state.activeThreads[threadId] = thread;
      });

      return threadId;
    },

    setResponseBlock: (threadId, blockId) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread) {
          thread.responseBlockId = blockId;
          thread.status = "streaming";
        }
      });
    },

    appendStreamContent: (threadId, chunk) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread) {
          thread.streamContent += chunk;
        }
      });
    },

    setStreamContent: (threadId, content) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread) {
          thread.streamContent = content;
        }
      });
    },

    completeThread: (threadId) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread) {
          thread.status = "complete";
          thread.abortController = null;
        }
      });
    },

    failThread: (threadId, error) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread) {
          thread.status = "error";
          thread.error = error;
          thread.abortController = null;
        }
      });
    },

    cancelThread: (threadId) => {
      set((state) => {
        const thread = state.activeThreads[threadId];
        if (thread?.abortController) {
          thread.abortController.abort();
        }
        delete state.activeThreads[threadId];
      });
    },

    removeThread: (threadId) => {
      set((state) => {
        delete state.activeThreads[threadId];
      });
    },

    getThread: (threadId) => {
      return get().activeThreads[threadId];
    },

    getThreadByPromptBlock: (blockId) => {
      const threads = Object.values(get().activeThreads);
      return threads.find((t) => t.promptBlockId === blockId);
    },

    getThreadByResponseBlock: (blockId) => {
      const threads = Object.values(get().activeThreads);
      return threads.find((t) => t.responseBlockId === blockId);
    },
  })),
);

export const useThread = (threadId: string) =>
  useThreadStore((s) => s.activeThreads[threadId]);

export const useThreadStatus = (threadId: string) =>
  useThreadStore((s) => s.activeThreads[threadId]?.status);

export const useThreadStreamContent = (threadId: string) =>
  useThreadStore((s) => s.activeThreads[threadId]?.streamContent ?? "");

export const useThreadByResponseBlock = (blockId: string) =>
  useThreadStore((s) =>
    Object.values(s.activeThreads).find((t) => t.responseBlockId === blockId),
  );

export const useActiveThreadCount = () =>
  Object.keys(useThreadStore.getState().activeThreads).length;

export const useIsStreaming = () =>
  Object.values(useThreadStore.getState().activeThreads).some(
    (t) => t.status === "streaming",
  );
