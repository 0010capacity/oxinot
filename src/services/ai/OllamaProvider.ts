import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

export class OllamaProvider implements IAIProvider {
  id = "ollama";
  private abortController: AbortController | null = null;

  async *generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.abortController = new AbortController();
    const baseUrl = request.baseUrl || "http://localhost:11434";
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/api/chat`;

    // Build messages array with history
    const messages: { role: string; content: string }[] = [];

    // Add system message if present
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    // Add history messages
    if (request.history) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current prompt
    messages.push({ role: "user", content: request.prompt });

    console.log("[OllamaProvider] Sending to API:");
    console.log("  Messages:", messages.length);
    let i = 0;
    for (const msg of messages) {
      console.log(`    [${i}] ${msg.role}: ${msg.content}`);
      i++;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: messages,
          stream: true,
          temperature: request.temperature ?? 0.3,
        }),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama sends multiple JSON objects in one chunk sometimes
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            // /api/chat uses message.content instead of response
            if (json.message?.content) {
              yield { type: "text", content: json.message.content };
            }
            if (json.done) return;
          } catch (e) {
            console.error("Failed to parse Ollama chunk:", line, e);
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("[OllamaProvider] Stream aborted");
        return;
      }
      console.error("Ollama generation failed:", error);
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
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

  abort(): void {
    this.abortController?.abort();
  }
}
