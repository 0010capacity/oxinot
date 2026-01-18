import type { AIRequest, IAIProvider } from "./types";

export class OpenAIProvider implements IAIProvider {
  id = "openai";
  
  // Allow overriding default Base URL for compatible services (like Groq, DeepSeek, etc)
  private defaultBaseUrl = "https://api.openai.com/v1";

  constructor(id?: string, baseUrl?: string) {
    if (id) this.id = id;
    if (baseUrl) this.defaultBaseUrl = baseUrl;
  }

  async *generateStream(request: AIRequest): AsyncGenerator<string, void, unknown> {
    const rawBaseUrl = request.baseUrl || this.defaultBaseUrl;
    const baseUrl = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const messages = [
      { role: "user", content: request.prompt },
    ];
    
    if (request.systemPrompt) {
      messages.unshift({ role: "system", content: request.systemPrompt });
    }

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
          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            console.error("Failed to parse OpenAI chunk:", data, e);
          }
        }
      }
    } catch (error) {
      console.error("OpenAI generation failed:", error);
      throw error;
    }
  }

  async generate(request: AIRequest): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(request)) {
      result += chunk;
    }
    return result;
  }

  async getModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
    const rawUrl = baseUrl || this.defaultBaseUrl;
    const cleanUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
    const url = cleanUrl.endsWith("/v1") ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`;

    if (!apiKey) return [];

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      if (!response.ok) throw new Error("Failed to fetch OpenAI models");
      
      const data = await response.json();
      // Filter for chat models usually, but returning all is safer for compatibility
      return data.data?.map((m: any) => m.id).sort() || [];
    } catch (e) {
      console.error("Failed to list OpenAI models:", e);
      return [];
    }
  }
}
