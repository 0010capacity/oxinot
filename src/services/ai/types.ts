import type { Tool } from "./tools/types";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;

  // Context & Tools
  history?: ChatMessage[]; // Previous chat history
  tools?: Tool[];
  onToolCall?: (
    toolName: string,
    params: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "error";
  content?: string;
  toolCall?: ToolCall;
  toolResult?: Record<string, unknown>;
  error?: string;
}

export interface IAIProvider {
  id: string;
  generateStream(
    request: AIRequest
  ): AsyncGenerator<StreamChunk, void, unknown>;
  generate(request: AIRequest): Promise<string>;
}
