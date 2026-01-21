import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";
import { toolToAIFunction } from "./tools/utils";

interface ClaudeContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface ClaudeMessage {
  role: string;
  content: string | ClaudeContentBlock[];
}

export class ClaudeProvider implements IAIProvider {
  id = "claude";

  async *generateStream(
    request: AIRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const baseUrl = request.baseUrl || "https://api.anthropic.com/v1";
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/messages`;

    // 1. Build initial messages
    const messages: ClaudeMessage[] = [];
    if (request.history) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: request.prompt });

    const claudeTools = request.tools?.map((tool) => {
      const aiFunc = toolToAIFunction(tool);
      return {
        name: aiFunc.name,
        description: aiFunc.description,
        input_schema: aiFunc.parameters,
      };
    });

    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      console.log("[ClaudeProvider] Sending to API:");
      console.log(
        "  System prompt:",
        `${request.systemPrompt?.substring(0, 100)}...`
      );
      console.log("  Messages:", messages.length);
      let i = 0;
      for (const msg of messages) {
        const contentStr =
          typeof msg.content === "string"
            ? msg.content
            : `[${Array.isArray(msg.content) ? msg.content.length : 0} blocks]`;
        console.log(`    [${i}] ${msg.role}: ${contentStr}`);
        i++;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": request.apiKey || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model || "claude-3-5-sonnet-20240620",
          max_tokens: 4096,
          system: request.systemPrompt,
          messages,
          tools:
            claudeTools && claudeTools.length > 0 ? claudeTools : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      let currentToolId = "";
      let currentToolName = "";
      let currentToolInput = "";
      let hasToolCall = false;
      let assistantContent = "";

      innerLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);

          try {
            const json = JSON.parse(data);

            if (
              json.type === "content_block_delta" &&
              json.delta?.type === "text_delta"
            ) {
              assistantContent += json.delta.text;
              yield { type: "text", content: json.delta.text };
            }

            if (
              json.type === "content_block_start" &&
              json.content_block?.type === "tool_use"
            ) {
              currentToolId = json.content_block.id;
              currentToolName = json.content_block.name;
              currentToolInput = "";
              hasToolCall = true;
            }

            if (
              json.type === "content_block_delta" &&
              json.delta?.type === "input_json_delta"
            ) {
              currentToolInput += json.delta.partial_json;
            }

            if (json.type === "message_stop") {
              if (hasToolCall) {
                // Finalize the last tool call
                try {
                  const args = JSON.parse(currentToolInput || "{}");
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: currentToolId,
                      name: currentToolName,
                      arguments: args,
                    },
                  };

                  if (request.onToolCall) {
                    // Claude history: Assistant turn with tool_use blocks
                    messages.push({
                      role: "assistant",
                      content: [
                        { type: "text", text: assistantContent },
                        {
                          type: "tool_use",
                          id: currentToolId,
                          name: currentToolName,
                          input: args,
                        },
                      ],
                    });

                    const result = await request.onToolCall(
                      currentToolName,
                      args
                    );
                    yield { type: "tool_result", toolResult: result };

                    // Claude history: User turn with tool_result block
                    messages.push({
                      role: "user",
                      content: [
                        {
                          type: "tool_result",
                          tool_use_id: currentToolId,
                          content: JSON.stringify(result),
                        },
                      ],
                    });

                    break innerLoop; // Break inner loop to continue outer while loop
                  }
                } catch (e) {
                  console.error("Claude tool err:", e);
                }
              } else {
                return; // No more tools, text response complete
              }
            }
          } catch (e) {}
        }
      }

      if (!hasToolCall) break;
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
