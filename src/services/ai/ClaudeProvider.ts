import { fetch } from "@tauri-apps/plugin-http";
import type { Tool } from "./tools/types";
import { toolToAIFunction } from "./tools/utils";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

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

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class ClaudeProvider implements IAIProvider {
  id = "claude";
  private abortController: AbortController | null = null;

  private cachedClaudeTools: ClaudeTool[] | null = null;
  private lastToolCount = 0;

  private getClaudeTools(tools: Tool[]): ClaudeTool[] {
    if (this.cachedClaudeTools && tools.length === this.lastToolCount) {
      return this.cachedClaudeTools;
    }

    this.cachedClaudeTools = tools.map((tool) => {
      const aiFunc = toolToAIFunction(tool);
      return {
        name: aiFunc.name,
        description: aiFunc.description,
        input_schema: aiFunc.parameters,
      };
    });
    this.lastToolCount = tools.length;
    return this.cachedClaudeTools;
  }

  async *generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.abortController = new AbortController();

    try {
      const baseUrl = request.baseUrl || "https://api.anthropic.com/v1";
      const cleanBaseUrl = baseUrl.endsWith("/")
        ? baseUrl.slice(0, -1)
        : baseUrl;
      const url = `${cleanBaseUrl}/messages`;

      const messages: ClaudeMessage[] = [];
      if (request.history) {
        for (const msg of request.history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: request.prompt });

      const claudeTools = request.tools
        ? this.getClaudeTools(request.tools)
        : undefined;

      console.log("[ClaudeProvider] Sending to API:");
      console.log(
        "  System prompt:",
        `${request.systemPrompt?.substring(0, 100)}...`,
      );
      console.log("  Messages:", messages.length);

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
          temperature: request.temperature ?? 0.3,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      const toolCalls = new Map<
        number,
        { id: string; name: string; input: string }
      >();

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

            if (
              json.type === "content_block_delta" &&
              json.delta?.type === "text_delta"
            ) {
              yield { type: "text", content: json.delta.text };
            }

            if (
              json.type === "content_block_start" &&
              json.content_block?.type === "tool_use"
            ) {
              const index = json.index ?? 0;
              toolCalls.set(index, {
                id: json.content_block.id,
                name: json.content_block.name,
                input: "",
              });
            }

            if (
              json.type === "content_block_delta" &&
              json.delta?.type === "input_json_delta"
            ) {
              const index = json.index ?? 0;
              const tc = toolCalls.get(index);
              if (tc) {
                tc.input += json.delta.partial_json;
              }
            }

            if (json.type === "message_stop") {
              for (const tc of toolCalls.values()) {
                try {
                  const args = JSON.parse(tc.input || "{}");
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: tc.id,
                      name: tc.name,
                      arguments: args,
                    },
                  };
                } catch (e) {
                  console.error("[ClaudeProvider] Tool parse error:", e);
                }
              }
              return;
            }
          } catch {}
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[ClaudeProvider] Stream aborted by user");
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
