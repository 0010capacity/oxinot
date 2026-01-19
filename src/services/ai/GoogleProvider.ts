import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";
import { toolsToAIFunctions } from "./tools/utils";

export class GoogleProvider implements IAIProvider {
  id = "google";

  async *generateStream(
    request: AIRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    let loopCount = 0;
    const MAX_LOOPS = 5;
    let conversationHistory = [...this.buildContents(request)];

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      try {
        const result = await this.generateWithTools(
          request,
          conversationHistory
        );

        // If text response, yield and return
        if (result.text) {
          const chunkSize = 10;
          for (let i = 0; i < result.text.length; i += chunkSize) {
            yield {
              type: "text",
              content: result.text.slice(i, i + chunkSize),
            };
            await new Promise((r) => setTimeout(r, 5));
          }
          return;
        }

        // If function call, execute it
        if (result.functionCall && request.onToolCall) {
          const { name, args } = result.functionCall;

          yield {
            type: "tool_call",
            toolCall: { id: `call_${Date.now()}`, name, arguments: args },
          };

          const toolResult = await request.onToolCall(name, args);

          yield { type: "tool_result", toolResult };

          // Add function call and result to history
          conversationHistory.push({
            role: "model",
            parts: [{ functionCall: { name, args } }],
          });
          conversationHistory.push({
            role: "user",
            parts: [{ functionResponse: { name, response: toolResult } }],
          });

          // Continue loop for next turn
          continue;
        }

        // No text and no function call - shouldn't happen
        return;
      } catch (error) {
        yield {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
        return;
      }
    }
  }

  private buildContents(request: AIRequest): any[] {
    const contents: any[] = [];

    // Add history messages
    if (request.history) {
      request.history.forEach((msg) => {
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role: role,
          parts: [{ text: msg.content }],
        });
      });
    }

    // Add current prompt
    contents.push({
      role: "user",
      parts: [{ text: request.prompt }],
    });

    return contents;
  }

  private async generateWithTools(
    request: AIRequest,
    contents: any[]
  ): Promise<{ text?: string; functionCall?: { name: string; args: any } }> {
    const model = request.model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${request.apiKey}`;

    const payload: Record<string, unknown> = {
      contents: contents,
    };

    if (request.systemPrompt) {
      payload.system_instruction = { parts: [{ text: request.systemPrompt }] };
    }

    // Add function declarations if tools provided
    if (request.tools && request.tools.length > 0) {
      const functions = toolsToAIFunctions(request.tools);
      payload.tools = [
        {
          function_declarations: functions.map((fn) => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          })),
        },
      ];
    }

    console.log("[GoogleProvider] Sending to API:");
    console.log(
      "  System prompt:",
      request.systemPrompt?.substring(0, 100) + "..."
    );
    console.log("  Contents:", contents.length);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API Error (${response.status}): ${errText}`);
    }

    const json = await response.json();
    const firstPart = json.candidates?.[0]?.content?.parts?.[0];

    if (!firstPart) {
      return { text: "" };
    }

    // Check if it's a function call
    if (firstPart.functionCall) {
      return {
        functionCall: {
          name: firstPart.functionCall.name,
          args: firstPart.functionCall.args || {},
        },
      };
    }

    // Otherwise it's text
    return { text: firstPart.text || "" };
  }

  async generate(request: AIRequest): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(request)) {
      if (chunk.type === "text" && chunk.content) {
        result += chunk.content;
      }
    }
    return result;
  }
}
