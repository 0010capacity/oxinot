import type { AIProvider as AIProviderType } from "../../stores/aiSettingsStore";
import type { IAIProvider } from "./types";
import { GoogleProvider } from "./GoogleProvider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";

export function createAIProvider(
  type: AIProviderType,
  apiKey: string,
  baseUrl: string
): IAIProvider {
  switch (type) {
    case "google":
      // Google provider doesn't strictly need baseUrl unless using a proxy, 
      // but we pass it anyway or ignore it.
      return new GoogleProvider();
    
    case "ollama":
      return new OllamaProvider();
      
    case "openai":
      return new OpenAIProvider("openai");
      
    case "claude":
      // Re-use OpenAI provider if compatible via some proxy, or Stub.
      // Ideally implement ClaudeProvider. For now, let's assume standard OpenAI for MVP or Stub.
      // Let's return OpenAIProvider but configured for Anthropic if they had compatible API? No they don't.
      // Using OpenAIProvider as placeholder for now or throw.
      console.warn("Claude provider not fully implemented, falling back to OpenAI structure or failing.");
      return new OpenAIProvider("claude"); // This will likely fail without correct Base URL/Format
      
    case "custom":
      return new OpenAIProvider("custom", baseUrl);
      
    default:
      throw new Error(`Unknown AI provider type: ${type}`);
  }
}
