import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

export class OllamaProvider implements IAIProvider {
  id = "ollama";

  async *generateStream(request: AIRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const baseUrl = request.baseUrl || "http://localhost:11434";
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/api/generate`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: true,
        }),
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
            if (json.response) {
              yield { type: "text", content: json.response };
            }
            if (json.done) return;
          } catch (e) {
            console.error("Failed to parse Ollama chunk:", line, e);
          }
        }
      }
    } catch (error) {
      console.error("Ollama generation failed:", error);
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
