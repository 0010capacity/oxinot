import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { v4 as uuidv4 } from "uuid";

export type AIProvider = "google" | "openai" | "claude" | "ollama" | "custom";

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string; // Mainly for Ollama or Custom (e.g., "http://localhost:11434")
  model: string;
  
  // Custom Prompt Templates
  promptTemplates: PromptTemplate[];
}

interface AISettingsStore extends AISettings {
  setProvider: (provider: AIProvider) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  
  // Template Actions
  addPromptTemplate: (name: string, content: string) => void;
  updatePromptTemplate: (id: string, updates: Partial<Omit<PromptTemplate, "id">>) => void;
  deletePromptTemplate: (id: string) => void;
  
  // Reset
  resetSettings: () => void;
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "default-summarize",
    name: "Summarize",
    content: "Summarize the following text concisely:",
  },
  {
    id: "default-fix-grammar",
    name: "Fix Grammar",
    content: "Fix grammar and improve clarity of the following text:",
  },
  {
    id: "default-translate-ko",
    name: "Translate to Korean",
    content: "Translate the following text to Korean:",
  },
  {
    id: "default-translate-en",
    name: "Translate to English",
    content: "Translate the following text to English:",
  },
];

const INITIAL_STATE: AISettings = {
  provider: "google",
  apiKey: "",
  baseUrl: "http://localhost:11434", // Default Ollama port
  model: "gemini-1.5-flash",
  promptTemplates: DEFAULT_TEMPLATES,
};

export const useAISettingsStore = createWithEqualityFn<AISettingsStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setModel: (model) => set({ model }),

      addPromptTemplate: (name, content) =>
        set((state) => ({
          promptTemplates: [
            ...state.promptTemplates,
            { id: uuidv4(), name, content },
          ],
        })),

      updatePromptTemplate: (id, updates) =>
        set((state) => ({
          promptTemplates: state.promptTemplates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      deletePromptTemplate: (id) =>
        set((state) => ({
          promptTemplates: state.promptTemplates.filter((t) => t.id !== id),
        })),
        
      resetSettings: () => set(INITIAL_STATE),
    }),
    {
      name: "ai-settings",
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        model: state.model,
        promptTemplates: state.promptTemplates,
      }),
    }
  )
);
