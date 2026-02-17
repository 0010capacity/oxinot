import { fetch } from "@tauri-apps/plugin-http";
import { toolsToOpenAITools } from "./tools/utils";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

export class OpenAIProvider implements IAIProvider {
  id = "openai";
  private defaultBaseUrl = "https://api.openai.com/v1";
  private abortController: AbortController | null = null;

  constructor(id?: string, baseUrl?: string) {
    if (id) this.id = id;
    if (baseUrl) this.defaultBaseUrl = baseUrl;
  }

  async *generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.abortController = new AbortController();

    const rawBaseUrl = request.baseUrl || this.defaultBaseUrl;
    const baseUrl = rawBaseUrl.endsWith("/")
      ? rawBaseUrl.slice(0, -1)
      : rawBaseUrl;
    const url = baseUrl.match(/\/v\d+$/)
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;

    console.log("[OpenAIProvider] API Request:", {
      url,
      hasApiKey: !!request.apiKey,
      apiKeyLength: request.apiKey?.length || 0,
      apiKeyPrefix: `${request.apiKey?.substring(0, 10)}...`,
      model: request.model,
      toolsCount: request.tools?.length || 0,
    });

    const messages: {
      role: string;
      content: string | null;
      name?: string;
      tool_call_id?: string;
    }[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    if (request.history) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: request.prompt });

    const tools = request.tools ? toolsToOpenAITools(request.tools) : undefined;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          tools,
          tool_choice: tools ? "auto" : undefined,
          stream: true,
          temperature: request.temperature ?? 0.3,
        }),
        signal: this.abortController.signal,
      });

      console.log("[OpenAIProvider] API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const toolCalls = new Map<
        number,
        { id: string; name: string; args: string }
      >();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;

            if (delta?.content) {
              yield { type: "text", content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const { index, id, function: fn } = toolCall;
                if (!toolCalls.has(index)) {
                  toolCalls.set(index, { id: id || "", name: "", args: "" });
                }
                const tc = toolCalls.get(index);
                if (tc) {
                  if (id) tc.id = id;
                  if (fn?.name) tc.name = fn.name;
                  if (fn?.arguments) tc.args += fn.arguments;
                }
              }
            }

            if (finishReason === "tool_calls" && toolCalls.size > 0) {
              for (const { id, name, args } of toolCalls.values()) {
                try {
                  const parsedArgs = JSON.parse(args || "{}");
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id,
                      name,
                      arguments: parsedArgs,
                    },
                  };
                } catch (e) {
                  console.error("[OpenAIProvider] Tool parse error:", e);
                }
              }
              return;
            }

            if (finishReason === "stop") {
              return;
            }
          } catch (e) {
            console.error("[OpenAIProvider] Parse error:", e);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[OpenAIProvider] Stream aborted by user");
        return;
      }
      throw error;
    }
  }

  async generate(request: AIRequest): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(request)) {
      if (chunk.type === "text" && chunk.content) result += chunk.content;
    }
    return result;
  }

  abort(): void {
    this.abortController?.abort();
  }
}
