import type { ToolResult } from "@/services/ai/tools/types";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";

export type SessionId = string;
export type MessageId = string;

export interface ChatSession {
  id: SessionId;
  title: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ToolCallInfo {
  toolName: string;
  params: unknown;
  result?: ToolResult;
  timestamp: number;
}

export interface ChatMessage {
  id: MessageId;
  role: "user" | "assistant" | "tool_trace";
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
}

export interface StreamingState {
  status: "idle" | "running" | "error";
  runId: string | null;
  partialContent: string;
  toolCallsInProgress: ToolCallInfo[];
  error: string | null;
}

export interface PanelRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface ChatState {
  sessions: Record<SessionId, ChatSession>;
  sessionOrder: SessionId[];
  messagesBySession: Record<SessionId, ChatMessage[]>;
  streamingBySession: Record<SessionId, StreamingState>;
  isOpen: boolean;
  activeSessionId: SessionId | null;
  panelRect: PanelRect;
}

interface ChatActions {
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  createSession: () => SessionId;
  deleteSession: (sessionId: SessionId) => void;
  switchSession: (sessionId: SessionId) => void;
  setActiveSession: (sessionId: SessionId | null) => void;
  addMessage: (
    sessionId: SessionId,
    message: Omit<ChatMessage, "id" | "timestamp">,
  ) => MessageId;
  updateMessage: (
    sessionId: SessionId,
    messageId: MessageId,
    content: string,
  ) => void;
  startStreaming: (sessionId: SessionId, runId: string) => void;
  appendStreamContent: (sessionId: SessionId, delta: string) => void;
  addStreamingToolCall: (
    sessionId: SessionId,
    toolCall: Omit<ToolCallInfo, "timestamp">,
  ) => void;
  completeToolCall: (
    sessionId: SessionId,
    toolName: string,
    result: ToolResult,
  ) => void;
  finishStreaming: (sessionId: SessionId) => void;
  failStreaming: (sessionId: SessionId, error: string) => void;
  updateSessionTitle: (sessionId: SessionId, title: string) => void;
  updateSessionLastActive: (sessionId: SessionId) => void;
  setPanelRect: (rect: Partial<PanelRect>) => void;
  loadPersisted: () => Promise<void>;
  persist: () => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

const MAX_SESSIONS = 10;
const DEFAULT_PANEL_RECT: PanelRect = {
  width: 420,
  height: 560,
  x: 0,
  y: 0,
};

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useChatStore = createWithEqualityFn<ChatStore>()(
  immer((set, get) => ({
    sessions: {},
    sessionOrder: [],
    messagesBySession: {},
    streamingBySession: {},
    isOpen: false,
    activeSessionId: null,
    panelRect: DEFAULT_PANEL_RECT,

    openPanel: () => {
      set((state) => {
        state.isOpen = true;
      });
    },

    closePanel: () => {
      set((state) => {
        state.isOpen = false;
      });
    },

    togglePanel: () => {
      set((state) => {
        state.isOpen = !state.isOpen;
      });
    },

    createSession: () => {
      const sessionId = generateId();
      const now = Date.now();

      set((state) => {
        state.sessions[sessionId] = {
          id: sessionId,
          title: "New Chat",
          createdAt: now,
          lastActiveAt: now,
        };
        state.sessionOrder.unshift(sessionId);
        state.messagesBySession[sessionId] = [];
        state.streamingBySession[sessionId] = {
          status: "idle",
          runId: null,
          partialContent: "",
          toolCallsInProgress: [],
          error: null,
        };
        state.activeSessionId = sessionId;

        while (state.sessionOrder.length > MAX_SESSIONS) {
          const oldestId = state.sessionOrder.pop();
          if (oldestId) {
            delete state.sessions[oldestId];
            delete state.messagesBySession[oldestId];
            delete state.streamingBySession[oldestId];
          }
        }
      });

      get().persist();
      return sessionId;
    },

    deleteSession: (sessionId) => {
      set((state) => {
        delete state.sessions[sessionId];
        delete state.messagesBySession[sessionId];
        delete state.streamingBySession[sessionId];
        state.sessionOrder = state.sessionOrder.filter(
          (id) => id !== sessionId,
        );

        if (state.activeSessionId === sessionId) {
          state.activeSessionId = state.sessionOrder[0] || null;
        }
      });

      get().persist();
    },

    switchSession: (sessionId) => {
      set((state) => {
        if (state.sessions[sessionId]) {
          state.activeSessionId = sessionId;
        }
      });
    },

    setActiveSession: (sessionId) => {
      set((state) => {
        state.activeSessionId = sessionId;
      });
    },

    addMessage: (sessionId, message) => {
      const messageId = generateId();
      const timestamp = Date.now();

      set((state) => {
        if (!state.messagesBySession[sessionId]) {
          state.messagesBySession[sessionId] = [];
        }
        state.messagesBySession[sessionId].push({
          ...message,
          id: messageId,
          timestamp,
        });
      });

      get().updateSessionLastActive(sessionId);
      get().persist();
      return messageId;
    },

    updateMessage: (sessionId, messageId, content) => {
      set((state) => {
        const messages = state.messagesBySession[sessionId];
        if (messages) {
          const msg = messages.find((m) => m.id === messageId);
          if (msg) {
            msg.content = content;
          }
        }
      });
    },

    startStreaming: (sessionId, runId) => {
      set((state) => {
        if (!state.streamingBySession[sessionId]) {
          state.streamingBySession[sessionId] = {
            status: "idle",
            runId: null,
            partialContent: "",
            toolCallsInProgress: [],
            error: null,
          };
        }
        state.streamingBySession[sessionId].status = "running";
        state.streamingBySession[sessionId].runId = runId;
        state.streamingBySession[sessionId].partialContent = "";
        state.streamingBySession[sessionId].toolCallsInProgress = [];
        state.streamingBySession[sessionId].error = null;
      });
    },

    appendStreamContent: (sessionId, delta) => {
      set((state) => {
        const streaming = state.streamingBySession[sessionId];
        if (streaming) {
          streaming.partialContent += delta;
        }
      });
    },

    addStreamingToolCall: (sessionId, toolCall) => {
      set((state) => {
        const streaming = state.streamingBySession[sessionId];
        if (streaming) {
          streaming.toolCallsInProgress.push({
            ...toolCall,
            timestamp: Date.now(),
          });
        }
      });
    },

    completeToolCall: (sessionId, toolName, result) => {
      set((state) => {
        const streaming = state.streamingBySession[sessionId];
        if (streaming) {
          const tc = streaming.toolCallsInProgress.find(
            (t) => t.toolName === toolName && !t.result,
          );
          if (tc) {
            tc.result = result;
          }
        }
      });
    },

    finishStreaming: (sessionId) => {
      const state = get();
      const streaming = state.streamingBySession[sessionId];

      if (streaming?.partialContent) {
        get().addMessage(sessionId, {
          role: "assistant",
          content: streaming.partialContent,
        });
      }

      if (streaming && streaming.toolCallsInProgress.length > 0) {
        get().addMessage(sessionId, {
          role: "tool_trace",
          content: "",
          toolCalls: streaming.toolCallsInProgress,
        });
      }

      set((s) => {
        const st = s.streamingBySession[sessionId];
        if (st) {
          st.status = "idle";
          st.runId = null;
          st.partialContent = "";
          st.toolCallsInProgress = [];
        }
      });
    },

    failStreaming: (sessionId, error) => {
      set((state) => {
        const streaming = state.streamingBySession[sessionId];
        if (streaming) {
          streaming.status = "error";
          streaming.error = error;
        }
      });
    },

    updateSessionTitle: (sessionId, title) => {
      set((state) => {
        if (state.sessions[sessionId]) {
          state.sessions[sessionId].title = title;
        }
      });

      get().persist();
    },

    updateSessionLastActive: (sessionId) => {
      set((state) => {
        if (state.sessions[sessionId]) {
          state.sessions[sessionId].lastActiveAt = Date.now();
        }
      });
    },

    setPanelRect: (rect) => {
      set((state) => {
        state.panelRect = { ...state.panelRect, ...rect };
      });

      get().persist();
    },

    loadPersisted: async () => {
      try {
        const appData = await appDataDir();
        const filePath = await join(appData, "chat-sessions.json");
        const content = await invoke<string>("read_file", { filePath });
        const data = JSON.parse(content);

        set((state) => {
          state.sessions = data.sessions || {};
          state.sessionOrder = data.sessionOrder || [];
          state.messagesBySession = data.messagesBySession || {};
          state.panelRect = data.panelRect || DEFAULT_PANEL_RECT;

          for (const sessionId of state.sessionOrder) {
            state.streamingBySession[sessionId] = {
              status: "idle",
              runId: null,
              partialContent: "",
              toolCallsInProgress: [],
              error: null,
            };
          }

          if (state.sessionOrder.length > 0) {
            state.activeSessionId = state.sessionOrder[0];
          }
        });

        console.log(
          "[chatStore] Loaded persisted sessions:",
          get().sessionOrder.length,
        );
      } catch (error) {
        console.log(
          "[chatStore] No persisted data found or load failed:",
          error,
        );
      }
    },

    persist: async () => {
      try {
        const state = get();
        const data = {
          sessions: state.sessions,
          sessionOrder: state.sessionOrder,
          messagesBySession: state.messagesBySession,
          panelRect: state.panelRect,
        };

        const appData = await appDataDir();
        const filePath = await join(appData, "chat-sessions.json");

        await invoke("write_file", {
          filePath,
          content: JSON.stringify(data, null, 2),
        });
      } catch (error) {
        console.error("[chatStore] Failed to persist:", error);
      }
    },
  })),
);

export const useChatSessions = () =>
  useChatStore((s) =>
    s.sessionOrder.map((id) => s.sessions[id]).filter(Boolean),
  );

export const useActiveSession = () =>
  useChatStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );

export const useActiveSessionMessages = () =>
  useChatStore((s) =>
    s.activeSessionId ? s.messagesBySession[s.activeSessionId] || [] : [],
  );

export const useActiveStreamingState = () =>
  useChatStore((s) =>
    s.activeSessionId ? s.streamingBySession[s.activeSessionId] : null,
  );

export const useIsPanelOpen = () => useChatStore((s) => s.isOpen);

export const usePanelRect = () => useChatStore((s) => s.panelRect);
