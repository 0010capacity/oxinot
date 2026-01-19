import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";
import { toolsToAIFunctions } from "./tools/utils";

export class OpenAIProvider implements IAIProvider {
  id = "openai";
  
  // Allow overriding default Base URL for compatible services (like Groq, DeepSeek, etc)
  private defaultBaseUrl = "https://api.openai.com/v1";

  constructor(id?: string, baseUrl?: string) {
    if (id) this.id = id;
    if (baseUrl) this.defaultBaseUrl = baseUrl;
  }

  async *generateStream(request: AIRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const rawBaseUrl = request.baseUrl || this.defaultBaseUrl;
    const baseUrl = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const messages = [
      { role: "user", content: request.prompt },
    ];
    
    if (request.systemPrompt) {
      messages.unshift({ role: "system", content: request.systemPrompt });
    }

    // Convert tools to OpenAI function format
    const functions = request.tools ? toolsToAIFunctions(request.tools) : undefined;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          functions,
          function_call: request.tools && request.tools.length > 0 ? "auto" : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      // State for function calling
      let currentFunctionName = "";
      let currentFunctionArgs = "";
      let isCallingFunction = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          
          const data = trimmed.slice(6); // Remove "data: " prefix
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;

            // Handle text content
            if (delta?.content) {
              yield { type: "text", content: delta.content };
            }

            // Handle function call
            if (delta?.function_call) {
              isCallingFunction = true;
              if (delta.function_call.name) {
                currentFunctionName = delta.function_call.name;
              }
              if (delta.function_call.arguments) {
                currentFunctionArgs += delta.function_call.arguments;
              }
            }

            // If function call is complete (finish_reason is function_call or stop)
            if (isCallingFunction && (finishReason === "function_call" || finishReason === "stop")) {
               try {
                 const args = JSON.parse(currentFunctionArgs || "{}");
                 
                 yield {
                   type: "tool_call",
                   toolCall: {
                     id: json.id || "call_unknown",
                     name: currentFunctionName,
                     arguments: args,
                   },
                 };

                 if (request.onToolCall) {
                   const result = await request.onToolCall(currentFunctionName, args);
                   yield {
                     type: "tool_result",
                     toolResult: result,
                   };
                 }
               } catch (e) {
                 console.error("Failed to parse function args or execute tool:", e);
                 yield { type: "error", error: "Failed to execute tool" };
               }
               
               // Reset state
               isCallingFunction = false;
               currentFunctionName = "";
               currentFunctionArgs = "";
            }

          } catch (e) {
            console.error("Failed to parse OpenAI chunk:", data, e);
          }
        }
      }
    } catch (error) {
      console.error("OpenAI generation failed:", error);
      yield { type: "error", error: error instanceof Error ? error.message : "Unknown error" };
    }
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
