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
    // Initialize abort controller for this stream
    this.abortController = new AbortController();

    try {
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

      // 1. Build initial messages
      const messages: {
        role: string;
        content: string | null;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
        name?: string;
        tool_call_id?: string;
      }[] = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      if (request.history) {
        for (const msg of request.history) {
          // Map history roles
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: request.prompt });

      const tools = request.tools
        ? toolsToOpenAITools(request.tools)
        : undefined;

      // 2. Loop for potential multiple tool calls
      let loopCount = 0;
      const MAX_LOOPS = 5;

      while (loopCount < MAX_LOOPS) {
        loopCount++;

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
          throw new Error(
            `OpenAI API error (${response.status}): ${errorText}`,
          );
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const toolCalls = new Map<
          string,
          { id: string; name: string; args: string }
        >();
        let isCallingFunction = false;
        let fullAssistantContent = "";

        innerLoop: while (true) {
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
                fullAssistantContent += delta.content;
                yield { type: "text", content: delta.content };
              }

              if (delta?.tool_calls) {
                isCallingFunction = true;
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

              // Tool Call detected and turn ended
              if (
                finishReason === "tool_calls" ||
                (isCallingFunction && finishReason === "stop")
              ) {
                // Store tool results to avoid double execution
                const toolResults: Array<{
                  id: string;
                  name: string;
                  result: unknown;
                }> = [];

                // Yield all tool calls
                for (const { id, name, args } of toolCalls.values()) {
                  const parsedArgs = JSON.parse(args || "{}");

                  yield {
                    type: "tool_call",
                    toolCall: {
                      id,
                      name,
                      arguments: parsedArgs,
                    },
                  };

                  if (request.onToolCall) {
                    const result = await request.onToolCall(name, parsedArgs);
                    toolResults.push({ id, name, result });
                    yield { type: "tool_result", toolResult: result };
                  }
                }

                if (request.onToolCall && toolResults.length > 0) {
                  // Important: Push the assistant's tool calls to history before results
                  const assistantToolCalls = Array.from(toolCalls.values()).map(
                    ({ id, name, args }) => ({
                      id,
                      type: "function" as const,
                      function: { name, arguments: args },
                    }),
                  );
                  messages.push({
                    role: "assistant",
                    content: null,
                    tool_calls: assistantToolCalls,
                  });

                  // Push tool results to history (in same order as tool calls)
                  for (const { id, result } of toolResults) {
                    messages.push({
                      role: "tool",
                      tool_call_id: id,
                      content: JSON.stringify(result),
                    });
                  }

                  // Continue the outer while loop to get AI's response to the tool result
                  isCallingFunction = false;
                  break innerLoop;
                }
              }

              if (finishReason === "stop" && !isCallingFunction) {
                // Final text response received
                return;
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }

        // If we finished the inner loop without a function call, we're done
        if (!isCallingFunction) break;
      }
    } catch (error) {
      // Handle AbortError gracefully
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
