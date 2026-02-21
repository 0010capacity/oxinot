import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface FloatingPanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  blockId?: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: FloatingPanelMessage[];
  createdAt: number;
  updatedAt: number;
}

interface FloatingPanelState {
  isOpen: boolean;
  isExecuting: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentStreamingContent: string;
}

interface FloatingPanelActions {
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setExecuting: (executing: boolean) => void;
  createNewSession: () => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addUserMessage: (content: string, blockId?: string) => string;
  addAssistantMessage: (messageId: string, content: string) => string;
  setStreamingMessage: (messageId: string, isStreaming: boolean) => void;
  completeAssistantMessage: (messageId: string, content: string) => void;
  setCurrentStreamingContent: (content: string) => void;
  getCurrentSession: () => ChatSession | null;
}

type FloatingPanelStore = FloatingPanelState & FloatingPanelActions;

const MAX_SESSIONS = 10;

let messageIdCounter = 0;
const generateMessageId = () => `fp_msg_${Date.now()}_${++messageIdCounter}`;

const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useFloatingPanelStore = create<FloatingPanelStore>()(
  persist(
    immer((set, get) => ({
      isOpen: false,
      isExecuting: false,
      sessions: [],
      currentSessionId: null,
      currentStreamingContent: "",

      openPanel: () => {
        set((state) => {
          state.isOpen = true;
          if (!state.currentSessionId && state.sessions.length > 0) {
            state.currentSessionId = state.sessions[0].id;
          } else if (!state.currentSessionId) {
            const newSession: ChatSession = {
              id: generateSessionId(),
              title: "New Chat",
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            state.sessions.unshift(newSession);
            state.currentSessionId = newSession.id;
          }
        });
      },

      closePanel: () => {
        set((state) => {
          state.isOpen = false;
        });
      },

      togglePanel: () => {
        const { isOpen, openPanel, closePanel } = get();
        if (isOpen) {
          closePanel();
        } else {
          openPanel();
        }
      },

      setExecuting: (executing) => {
        set((state) => {
          state.isExecuting = executing;
        });
      },

      createNewSession: () => {
        const newSession: ChatSession = {
          id: generateSessionId(),
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          state.sessions.unshift(newSession);
          if (state.sessions.length > MAX_SESSIONS) {
            state.sessions = state.sessions.slice(0, MAX_SESSIONS);
          }
          state.currentSessionId = newSession.id;
          state.currentStreamingContent = "";
        });

        return newSession.id;
      },

      switchSession: (sessionId) => {
        set((state) => {
          if (state.sessions.some((s) => s.id === sessionId)) {
            state.currentSessionId = sessionId;
            state.currentStreamingContent = "";
          }
        });
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === sessionId);
          if (index !== -1) {
            state.sessions.splice(index, 1);
            if (state.currentSessionId === sessionId) {
              state.currentSessionId = state.sessions[0]?.id || null;
              state.currentStreamingContent = "";
            }
          }
        });
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            session.title = title;
            session.updatedAt = Date.now();
          }
        });
      },

      addUserMessage: (content, blockId) => {
        const state = get();
        let sessionId = state.currentSessionId;

        if (!sessionId) {
          sessionId = get().createNewSession();
        }

        const messageId = generateMessageId();
        set((s) => {
          const session = s.sessions.find((ses) => ses.id === sessionId);
          if (session) {
            session.messages.push({
              id: messageId,
              role: "user",
              content,
              timestamp: Date.now(),
              blockId,
            });
            session.updatedAt = Date.now();
          }
        });

        return messageId;
      },

      addAssistantMessage: (messageId, content) => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return "";

        const id = messageId || generateMessageId();
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            session.messages.push({
              id,
              role: "assistant",
              content,
              timestamp: Date.now(),
              isStreaming: true,
            });
          }
        });
        return id;
      },

      setStreamingMessage: (messageId, isStreaming) => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return;

        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            const message = session.messages.find((m) => m.id === messageId);
            if (message) {
              message.isStreaming = isStreaming;
            }
          }
        });
      },

      completeAssistantMessage: (messageId, content) => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return;

        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            const message = session.messages.find((m) => m.id === messageId);
            if (message) {
              message.content = content;
              message.isStreaming = false;
            }
            session.updatedAt = Date.now();
          }
          state.currentStreamingContent = "";
        });
      },

      setCurrentStreamingContent: (content) => {
        set((state) => {
          state.currentStreamingContent = content;
        });
      },

      getCurrentSession: () => {
        const state = get();
        return (
          state.sessions.find((s) => s.id === state.currentSessionId) || null
        );
      },
    })),
    {
      name: "floating-panel-sessions",
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    },
  ),
);

export const useIsFloatingPanelOpen = () =>
  useFloatingPanelStore((s) => s.isOpen);

export const useFloatingPanelSessions = () =>
  useFloatingPanelStore((s) => s.sessions);

export const useCurrentSession = () => {
  const currentSessionId = useFloatingPanelStore((s) => s.currentSessionId);
  const sessions = useFloatingPanelStore((s) => s.sessions);
  return sessions.find((s) => s.id === currentSessionId) || null;
};

export const useCurrentSessionMessages = () => {
  const session = useCurrentSession();
  return session?.messages || [];
};
