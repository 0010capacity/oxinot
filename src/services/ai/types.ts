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
  onToolCall?: (toolName: string, params: unknown) => Promise<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "error";
  content?: string;
  toolCall?: ToolCall;
  toolResult?: unknown;
  error?: string;
}

export interface IAIProvider {
  id: string;
  generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown>;
  generate(request: AIRequest): Promise<string>;
}
