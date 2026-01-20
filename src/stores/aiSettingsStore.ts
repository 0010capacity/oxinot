import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { v4 as uuidv4 } from "uuid";

export type AIProvider = "google" | "openai" | "claude" | "ollama" | "custom";

export type ToolApprovalPolicy = "always" | "dangerous_only" | "never";

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AISettings {
  provider: AIProvider;

  // Current active values (synced with configs[provider])
  apiKey: string;
  baseUrl: string;
  model: string;

  // Per-provider configuration
  configs: Record<AIProvider, ProviderConfig>;

  // Custom Prompt Templates
  promptTemplates: PromptTemplate[];

  // Tool Approval Policy
  toolApprovalPolicy: ToolApprovalPolicy;
}

interface AISettingsStore extends AISettings {
  setProvider: (provider: AIProvider) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setToolApprovalPolicy: (policy: ToolApprovalPolicy) => void;

  // Template Actions
  addPromptTemplate: (name: string, content: string) => void;
  updatePromptTemplate: (
    id: string,
    updates: Partial<Omit<PromptTemplate, "id">>
  ) => void;
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

const DEFAULT_CONFIGS: Record<AIProvider, ProviderConfig> = {
  google: { apiKey: "", baseUrl: "", model: "gemini-2.5-pro" },
  openai: { apiKey: "", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  claude: {
    apiKey: "",
    baseUrl: "https://api.anthropic.com",
    model: "claude-3-5-sonnet-20240620",
  },
  ollama: { apiKey: "", baseUrl: "http://localhost:11434", model: "llama3" },
  custom: { apiKey: "", baseUrl: "", model: "" },
};

const INITIAL_STATE: AISettings = {
  provider: "google",
  apiKey: DEFAULT_CONFIGS.google.apiKey,
  baseUrl: DEFAULT_CONFIGS.google.baseUrl,
  model: DEFAULT_CONFIGS.google.model,
  configs: DEFAULT_CONFIGS,
  promptTemplates: DEFAULT_TEMPLATES,
  toolApprovalPolicy: "dangerous_only",
};

export const useAISettingsStore = createWithEqualityFn<AISettingsStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setProvider: (newProvider) => {
        const state = get();
        // Save current values to the old provider config
        const updatedConfigs = { ...state.configs };
        updatedConfigs[state.provider] = {
          apiKey: state.apiKey,
          baseUrl: state.baseUrl,
          model: state.model,
        };

        // Load values for the new provider (merge with defaults to ensure all fields exist)
        const savedConfig = updatedConfigs[newProvider];
        const defaultConfig = DEFAULT_CONFIGS[newProvider];

        const newConfig = {
          apiKey: savedConfig?.apiKey ?? defaultConfig.apiKey,
          baseUrl: savedConfig?.baseUrl ?? defaultConfig.baseUrl,
          model: savedConfig?.model ?? defaultConfig.model,
        };

        set({
          provider: newProvider,
          configs: updatedConfigs,
          apiKey: newConfig.apiKey,
          baseUrl: newConfig.baseUrl,
          model: newConfig.model,
        });
      },

      setApiKey: (apiKey) =>
        set((state) => ({
          apiKey,
          configs: {
            ...state.configs,
            [state.provider]: { ...state.configs[state.provider], apiKey },
          },
        })),

      setBaseUrl: (baseUrl) =>
        set((state) => ({
          baseUrl,
          configs: {
            ...state.configs,
            [state.provider]: { ...state.configs[state.provider], baseUrl },
          },
        })),

      setModel: (model) =>
        set((state) => ({
          model,
          configs: {
            ...state.configs,
            [state.provider]: { ...state.configs[state.provider], model },
          },
        })),

      setToolApprovalPolicy: (toolApprovalPolicy) =>
        set({ toolApprovalPolicy }),

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
        configs: state.configs,
        // Also persist current values so they load correctly on startup without setProvider trigger
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        model: state.model,
        promptTemplates: state.promptTemplates,
        toolApprovalPolicy: state.toolApprovalPolicy,
      }),
      onRehydrateStorage: () => (state) => {
        if (
          state &&
          (!state.configs || Object.keys(state.configs).length === 0)
        ) {
          // Migration: Initialize configs if missing
          const provider = state.provider || "google";
          const configs = { ...DEFAULT_CONFIGS };

          // Assign whatever was in state (from old version) to the current provider
          configs[provider] = {
            apiKey: state.apiKey || "",
            baseUrl: state.baseUrl || DEFAULT_CONFIGS[provider].baseUrl,
            model: state.model || DEFAULT_CONFIGS[provider].model,
          };

          state.configs = configs;
        }
      },
    }
  )
);
