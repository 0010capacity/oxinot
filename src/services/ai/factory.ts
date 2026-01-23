import type { AIProvider as AIProviderType } from "../../stores/aiSettingsStore";
import type { IAIProvider } from "./types";
import { GoogleProvider } from "./GoogleProvider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { ClaudeProvider } from "./ClaudeProvider";

export function createAIProvider(
  type: AIProviderType,
  baseUrl: string,
): IAIProvider {
  switch (type) {
    case "google":
      return new GoogleProvider();

    case "ollama":
      return new OllamaProvider();

    case "openai":
      return new OpenAIProvider("openai");

    case "claude":
      return new ClaudeProvider();

    case "lmstudio":
      return new OpenAIProvider("lmstudio", baseUrl);

    case "custom":
      return new OpenAIProvider("custom", baseUrl);

    default:
      throw new Error(`Unknown AI provider type: ${type}`);
  }
}
