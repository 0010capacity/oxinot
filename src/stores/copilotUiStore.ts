import { create } from "zustand";

export type CopilotMode = "edit" | "generate" | "chat";
export type CopilotScope = "block" | "selection" | "page";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface CopilotUiStore {
  isOpen: boolean;
  mode: CopilotMode;
  scope: CopilotScope;
  inputValue: string;
  isLoading: boolean;
  
  // Streaming Content State (for Preview)
  previewContent: string;
  originalContent: string | null; // For Undo/Diff

  // Chat Mode State
  chatMessages: ChatMessage[];

  open: () => void;
  close: () => void;
  toggle: () => void;
  setMode: (mode: CopilotMode) => void;
  setScope: (scope: CopilotScope) => void;
  setInputValue: (value: string) => void;
  setIsLoading: (loading: boolean) => void;
  setPreviewContent: (content: string) => void;
  setOriginalContent: (content: string | null) => void;
  
  // Chat Actions
  addChatMessage: (role: "user" | "assistant", content: string) => void;
  updateLastChatMessage: (content: string) => void;
  clearChatMessages: () => void;
  
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

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setMode: (mode) => set({ mode }),
  setScope: (scope) => set({ scope }),
  setInputValue: (inputValue) => set({ inputValue }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setPreviewContent: (previewContent) => set({ previewContent }),
  setOriginalContent: (originalContent) => set({ originalContent }),

  addChatMessage: (role, content) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        { id: Date.now().toString(), role, content },
      ],
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

  reset: () =>
    set({
      mode: "edit",
      scope: "block",
      inputValue: "",
      isLoading: false,
      previewContent: "",
      originalContent: null,
      chatMessages: [],
    }),
}));