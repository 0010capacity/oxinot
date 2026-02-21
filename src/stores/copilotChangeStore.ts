import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";

export type ChangeType = "create" | "update" | "delete";

export interface CopilotChange {
  id: string;
  sessionId: string;
  type: ChangeType;
  toolName: string;
  description: string;
  blockId?: string;
  pageId?: string;
  before?: unknown;
  after?: unknown;
  timestamp: number;
  status: "pending" | "kept" | "reverted";
}

interface CopilotChangeState {
  changesBySession: Record<string, CopilotChange[]>;
}

interface CopilotChangeActions {
  recordChange: (
    change: Omit<CopilotChange, "id" | "timestamp" | "status">,
  ) => string;
  keepChange: (sessionId: string, changeId: string) => void;
  revertChange: (sessionId: string, changeId: string) => Promise<void>;
  keepAllChanges: (sessionId: string) => void;
  revertAllChanges: (sessionId: string) => Promise<void>;
  getPendingChanges: (sessionId: string) => CopilotChange[];
  clearSessionChanges: (sessionId: string) => void;
  clearResolvedChanges: (sessionId: string) => void;
}

type CopilotChangeStore = CopilotChangeState & CopilotChangeActions;

let changeIdCounter = 0;
const generateChangeId = () => `change_${Date.now()}_${++changeIdCounter}`;

export const useCopilotChangeStore = createWithEqualityFn<CopilotChangeStore>()(
  immer((set, get) => ({
    changesBySession: {},

    recordChange: (change) => {
      const id = generateChangeId();
      const newChange: CopilotChange = {
        ...change,
        id,
        timestamp: Date.now(),
        status: "pending",
      };

      set((state) => {
        if (!state.changesBySession[change.sessionId]) {
          state.changesBySession[change.sessionId] = [];
        }
        state.changesBySession[change.sessionId].push(newChange);
      });

      return id;
    },

    keepChange: (sessionId, changeId) => {
      set((state) => {
        const changes = state.changesBySession[sessionId];
        if (changes) {
          const change = changes.find((c) => c.id === changeId);
          if (change) {
            change.status = "kept";
          }
        }
      });
    },

    revertChange: async (sessionId, changeId) => {
      const state = get();
      const changes = state.changesBySession[sessionId];
      const change = changes?.find((c) => c.id === changeId);

      if (!change || !change.before) {
        console.warn(
          "[CopilotChangeStore] Cannot revert: change not found or no before state",
        );
        return;
      }

      const { useBlockStore } = await import("./blockStore");
      const { usePageStore } = await import("./pageStore");

      try {
        switch (change.type) {
          case "create": {
            if (change.blockId) {
              useBlockStore.getState().deleteBlock(change.blockId);
            } else if (change.pageId) {
              await usePageStore.getState().deletePage(change.pageId);
            }
            break;
          }
          case "update": {
            if (change.blockId && change.before) {
              const beforeData = change.before as { content?: string };
              if (beforeData.content !== undefined) {
                useBlockStore
                  .getState()
                  .updateBlockContent(change.blockId, beforeData.content);
              }
            }
            break;
          }
          case "delete": {
            if (change.blockId && change.before) {
              console.log(
                "[CopilotChangeStore] Would recreate block:",
                change.before,
              );
            }
            break;
          }
        }

        set((state) => {
          const changes = state.changesBySession[sessionId];
          if (changes) {
            const c = changes.find((c) => c.id === changeId);
            if (c) {
              c.status = "reverted";
            }
          }
        });
      } catch (error) {
        console.error("[CopilotChangeStore] Revert failed:", error);
        throw error;
      }
    },

    keepAllChanges: (sessionId) => {
      set((state) => {
        const changes = state.changesBySession[sessionId];
        if (changes) {
          for (const change of changes) {
            if (change.status === "pending") {
              change.status = "kept";
            }
          }
        }
      });
    },

    revertAllChanges: async (sessionId) => {
      const state = get();
      const changes = state.changesBySession[sessionId];
      const pendingChanges =
        changes?.filter((c) => c.status === "pending") || [];

      // Revert in reverse order (newest first)
      for (const change of [...pendingChanges].reverse()) {
        try {
          await get().revertChange(sessionId, change.id);
        } catch (error) {
          console.error(
            `[CopilotChangeStore] Failed to revert change ${change.id}:`,
            error,
          );
        }
      }
    },

    getPendingChanges: (sessionId) => {
      const state = get();
      return (state.changesBySession[sessionId] || []).filter(
        (c) => c.status === "pending",
      );
    },

    clearSessionChanges: (sessionId) => {
      set((state) => {
        delete state.changesBySession[sessionId];
      });
    },

    clearResolvedChanges: (sessionId) => {
      set((state) => {
        const changes = state.changesBySession[sessionId];
        if (changes) {
          state.changesBySession[sessionId] = changes.filter(
            (c) => c.status === "pending",
          );
        }
      });
    },
  })),
);

// Selector hooks
export const usePendingChanges = (sessionId: string | null) =>
  useCopilotChangeStore((s) =>
    sessionId
      ? (s.changesBySession[sessionId] || []).filter(
          (c) => c.status === "pending",
        )
      : [],
  );

export const useHasPendingChanges = (sessionId: string | null) =>
  useCopilotChangeStore((s) =>
    sessionId
      ? (s.changesBySession[sessionId] || []).some(
          (c) => c.status === "pending",
        )
      : false,
  );
