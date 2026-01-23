import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";
import { toolsToAIFunctions } from "./tools/utils";

export class OpenAIProvider implements IAIProvider {
  id = "openai";
  private defaultBaseUrl = "https://api.openai.com/v1";

  constructor(id?: string, baseUrl?: string) {
    if (id) this.id = id;
    if (baseUrl) this.defaultBaseUrl = baseUrl;
  }

  async *generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const rawBaseUrl = request.baseUrl || this.defaultBaseUrl;
    const baseUrl = rawBaseUrl.endsWith("/")
      ? rawBaseUrl.slice(0, -1)
      : rawBaseUrl;
    const url = baseUrl.match(/\/v\d+$/)
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;

    // 1. Build initial messages
    const messages: {
      role: string;
      content: string | null;
      function_call?: { name: string; arguments: string };
      name?: string;
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

    const functions = request.tools
      ? toolsToAIFunctions(request.tools)
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
          functions,
          function_call: functions ? "auto" : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let currentFunctionName = "";
      let currentFunctionArgs = "";
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

            if (delta?.function_call) {
              isCallingFunction = true;
              if (delta.function_call.name)
                currentFunctionName = delta.function_call.name;
              if (delta.function_call.arguments)
                currentFunctionArgs += delta.function_call.arguments;
            }

            // Function Call detected and turn ended
            if (
              finishReason === "function_call" ||
              (isCallingFunction && finishReason === "stop")
            ) {
              const args = JSON.parse(currentFunctionArgs || "{}");

              yield {
                type: "tool_call",
                toolCall: {
                  id: json.id || `call_${Date.now()}`,
                  name: currentFunctionName,
                  arguments: args,
                },
              };

              if (request.onToolCall) {
                // Important: Push the assistant's call to history before the result
                messages.push({
                  role: "assistant",
                  content: null,
                  function_call: {
                    name: currentFunctionName,
                    arguments: currentFunctionArgs,
                  },
                });

                const result = await request.onToolCall(
                  currentFunctionName,
                  args,
                );

                yield { type: "tool_result", toolResult: result };

                // Push tool result to history
                messages.push({
                  role: "function",
                  name: currentFunctionName,
                  content: JSON.stringify(result),
                });

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
  }

  async generate(request: AIRequest): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(request)) {
      if (chunk.type === "text" && chunk.content) result += chunk.content;
    }
    return result;
  }
}
