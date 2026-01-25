import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { v4 as uuidv4 } from "uuid";

export type AIProvider =
  | "google"
  | "openai"
  | "claude"
  | "ollama"
  | "lmstudio"
  | "zai"
  | "zai-coding-plan"
  | "custom";

export type ToolApprovalPolicy = "always" | "dangerous_only" | "never";

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  models: string[];
  temperature: number;
}

interface AISettings {
  provider: AIProvider;

  // Current active values (synced with configs[provider])
  apiKey: string;
  baseUrl: string;
  models: string[];
  temperature: number;

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
  setModels: (models: string[]) => void;
  setTemperature: (temperature: number) => void;
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
  google: {
    apiKey: "",
    baseUrl: "",
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
    temperature: 0.3,
  },
  openai: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano"],
    temperature: 0.3,
  },
  claude: {
    apiKey: "",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
    temperature: 0.3,
  },
  ollama: {
    apiKey: "",
    baseUrl: "http://localhost:11434",
    models: ["llama3", "llama3:70b", "mistral", "codellama"],
    temperature: 0.3,
  },
  lmstudio: {
    apiKey: "",
    baseUrl: "http://localhost:1234/v1",
    models: ["local-model", "llama-3-8b-instruct", "mistral-7b-instruct"],
    temperature: 0.3,
  },
  custom: {
    apiKey: "",
    baseUrl: "",
    models: [],
    temperature: 0.3,
  },
  zai: {
    apiKey: "",
    baseUrl: "https://api.z.ai/api/paas/v4",
    models: ["glm-4.7", "glm-4.7-flash", "glm-4.6"],
    temperature: 0.3,
  },
  "zai-coding-plan": {
    apiKey: "",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    models: ["glm-4.7", "glm-4.7-flash", "glm-4.6"],
    temperature: 0.3,
  },
};

const INITIAL_STATE: AISettings = {
  provider: "google",
  apiKey: DEFAULT_CONFIGS.google.apiKey,
  baseUrl: DEFAULT_CONFIGS.google.baseUrl,
  models: DEFAULT_CONFIGS.google.models,
  temperature: DEFAULT_CONFIGS.google.temperature,
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
          models: state.models,
          temperature: state.temperature,
        };

        // Load values for the new provider (merge with defaults to ensure all fields exist)
        const savedConfig = updatedConfigs[newProvider];
        const defaultConfig = DEFAULT_CONFIGS[newProvider];

        const newConfig = {
          apiKey: savedConfig?.apiKey ?? defaultConfig.apiKey,
          baseUrl: savedConfig?.baseUrl ?? defaultConfig.baseUrl,
          models:
            savedConfig?.models !== undefined
              ? savedConfig.models
              : defaultConfig.models,
          temperature: savedConfig?.temperature ?? defaultConfig.temperature,
        };

        set({
          provider: newProvider,
          configs: updatedConfigs,
          apiKey: newConfig.apiKey,
          baseUrl: newConfig.baseUrl,
          models: newConfig.models,
          temperature: newConfig.temperature,
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
        set((state) => {
          // Replace first model in the list
          // If models array is empty, don't add the model (user intentionally deleted all)
          if (state.models.length === 0) {
            return state;
          }
          const newModels = [model, ...state.models.slice(1)];
          return {
            models: newModels,
            configs: {
              ...state.configs,
              [state.provider]: {
                ...state.configs[state.provider],
                models: newModels,
              },
            },
          };
        }),

      setModels: (models) =>
        set((state) => {
          // Deduplicate models to prevent duplicate keys in UI
          const deduplicatedModels = Array.from(new Set(models));
          return {
            models: deduplicatedModels,
            configs: {
              ...state.configs,
              [state.provider]: {
                ...state.configs[state.provider],
                models: deduplicatedModels,
              },
            },
          };
        }),

      setTemperature: (temperature) =>
        set((state) => ({
          temperature,
          configs: {
            ...state.configs,
            [state.provider]: {
              ...state.configs[state.provider],
              temperature,
            },
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
        models: state.models,
        temperature: state.temperature,
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

          // Migrate from old schema (model string) to new schema (models array)
          const oldModel = (state as unknown as Record<string, unknown>).model;
          if (oldModel && typeof oldModel === "string") {
            configs[provider].models = [
              oldModel,
              ...DEFAULT_CONFIGS[provider].models,
            ];
          }

          // Assign whatever was in state (from old version) to the current provider
          // Only use defaults if the models array is undefined, not if it's empty
          const savedModels = state.models;
          const deduplicatedModels = savedModels
            ? Array.from(new Set(savedModels))
            : undefined;
          configs[provider] = {
            apiKey: state.apiKey || "",
            baseUrl: state.baseUrl || DEFAULT_CONFIGS[provider].baseUrl,
            models: deduplicatedModels ?? DEFAULT_CONFIGS[provider].models,
            temperature:
              state.temperature ?? DEFAULT_CONFIGS[provider].temperature,
          };

          state.configs = configs;
          state.models = configs[provider].models;
          state.temperature = configs[provider].temperature;
        }
      },
    }
  )
);
