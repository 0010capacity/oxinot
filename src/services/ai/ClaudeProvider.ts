import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";
import { toolToAIFunction } from "./tools/utils";

export class ClaudeProvider implements IAIProvider {
  id = "claude";

  async *generateStream(request: AIRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const baseUrl = request.baseUrl || "https://api.anthropic.com/v1";
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/messages`;

    // Build messages array
    const messages: any[] = [];

    // Chat History (exclude UI-system messages)
    if (request.history) {
      request.history.forEach(msg => {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Current User Prompt
    messages.push({ role: "user", content: request.prompt });

    const claudeTools = request.tools?.map(tool => {
      const aiFunc = toolToAIFunction(tool);
      return {
        name: aiFunc.name,
        description: aiFunc.description,
        input_schema: aiFunc.parameters,
      };
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": request.apiKey || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model || "claude-3-sonnet-20240229",
          max_tokens: 4096,
          system: request.systemPrompt,
          messages,
          tools: claudeTools && claudeTools.length > 0 ? claudeTools : undefined,
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

      while (true) {
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
            
            if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
              yield { type: "text", content: json.delta.text };
            }

            if (json.type === "content_block_start" && json.content_block?.type === "tool_use") {
              currentToolId = json.content_block.id;
              currentToolName = json.content_block.name;
              currentToolInput = "";
            }

            if (json.type === "content_block_delta" && json.delta?.type === "input_json_delta") {
              currentToolInput += json.delta.partial_json;
            }

            if (json.type === "content_block_stop") {
              if (currentToolId && currentToolName) {
                try {
                  const args = JSON.parse(currentToolInput || "{}");
                  yield {
                    type: "tool_call",
                    toolCall: { id: currentToolId, name: currentToolName, arguments: args },
                  };

                  if (request.onToolCall) {
                    const result = await request.onToolCall(currentToolName, args);
                    yield { type: "tool_result", toolResult: result };
                  }
                } catch (e) {
                  console.error("Failed to parse tool input:", e);
                }
                currentToolId = "";
                currentToolName = "";
                currentToolInput = "";
              }
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      yield { type: "error", error: error instanceof Error ? error.message : "Unknown error" };
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
