import { fetch } from "@tauri-apps/plugin-http";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

export class GoogleProvider implements IAIProvider {
  id = "google";

  // MVP: Fake streaming for Google until proper JSON stream parser is added
  async *generateStream(
    request: AIRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      const text = await this.generate(request);

      // Simulate chunks for UX consistency
      const chunkSize = 10;
      for (let i = 0; i < text.length; i += chunkSize) {
        yield { type: "text", content: text.slice(i, i + chunkSize) };
        // Tiny delay to allow UI updates
        await new Promise((r) => setTimeout(r, 5));
      }
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async generate(request: AIRequest): Promise<string> {
    const model = request.model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${request.apiKey}`;

    // Build contents array with history
    const contents: any[] = [];

    // Add history messages
    if (request.history) {
      request.history.forEach((msg) => {
        // Gemini uses "user" and "model" roles
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

    const payload: Record<string, unknown> = {
      contents: contents,
    };

    if (request.systemPrompt) {
      payload.system_instruction = { parts: [{ text: request.systemPrompt }] };
    }

    console.log("[GoogleProvider] Sending to API:");
    console.log(
      "  System prompt:",
      request.systemPrompt?.substring(0, 100) + "..."
    );
    console.log("  Contents:", contents.length);
    contents.forEach((msg, i) => {
      console.log(`    [${i}] ${msg.role}: ${msg.parts[0].text}`);
    });

    try {
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
      return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      console.error("Google AI Request Failed:", e);
      throw e;
    }
  }
}
