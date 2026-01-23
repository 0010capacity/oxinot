import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export type CopilotMode = "edit" | "generate" | "chat";
export type CopilotScope = "block" | "selection" | "page";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface CopilotUiStore {
  isOpen: boolean;
  mode: CopilotMode;
  scope: CopilotScope;
  inputValue: string;
  isLoading: boolean;

  // Panel Width
  panelWidth: number;

  // Streaming Content State (for Preview)
  previewContent: string;
  originalContent: string | null; // For Undo/Diff

  // Chat Mode State
  chatMessages: ChatMessage[];
  lastPageId: string | null; // Track page changes for context

  open: () => void;
  close: () => void;
  toggle: () => void;
  setMode: (mode: CopilotMode) => void;
  setScope: (scope: CopilotScope) => void;
  setInputValue: (value: string) => void;
  setIsLoading: (loading: boolean) => void;
  setPreviewContent: (content: string) => void;
  setOriginalContent: (content: string | null) => void;
  setPanelWidth: (width: number) => void;

  // Chat Actions
  addChatMessage: (
    role: "user" | "assistant" | "system",
    content: string,
  ) => void;
  updateLastChatMessage: (content: string) => void;
  clearChatMessages: () => void;
  updatePageContext: (pageId: string, pageTitle: string) => void;

  reset: () => void;
}

export const useCopilotUiStore = create<CopilotUiStore>((set) => ({
  isOpen: false,
  mode: "edit",
  scope: "block",
  inputValue: "",
  isLoading: false,
  previewContent: "",
  originalContent: null,
  chatMessages: [],
  lastPageId: null,
  panelWidth: 450,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setMode: (mode) => set({ mode }),
  setScope: (scope) => set({ scope }),
  setInputValue: (inputValue) => set({ inputValue }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setPreviewContent: (previewContent) => set({ previewContent }),
  setOriginalContent: (originalContent) => set({ originalContent }),
  setPanelWidth: (width) => set({ panelWidth: Math.max(300, Math.min(800, width)) }),

  addChatMessage: (role, content) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, { id: uuidv4(), role, content }],
    })),

  updateLastChatMessage: (content) =>
    set((state) => {
      const messages = [...state.chatMessages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      return { chatMessages: messages };
    }),

  clearChatMessages: () => set({ chatMessages: [] }),

  updatePageContext: (pageId, pageTitle) =>
    set((state) => {
      // If page changed and there are existing messages, add context message
      if (
        state.lastPageId &&
        state.lastPageId !== pageId &&
        state.chatMessages.length > 0
      ) {
        return {
          lastPageId: pageId,
          chatMessages: [
            ...state.chatMessages,
            {
              id: uuidv4(),
              role: "system",
              content: `[Context: User navigated to page "${pageTitle}"]`,
            },
          ],
        };
      }
      // Just update lastPageId if no context message needed
      return { lastPageId: pageId };
    }),

  reset: () =>
    set({
      mode: "edit",
      scope: "block",
      inputValue: "",
      isLoading: false,
      previewContent: "",
      originalContent: null,
      chatMessages: [],
      lastPageId: null,
    }),
}));
