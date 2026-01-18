import type { AIRequest, IAIProvider } from "./types";

export class GoogleProvider implements IAIProvider {
  id = "google";

  // MVP: Fake streaming for Google until proper JSON stream parser is added
  async *generateStream(request: AIRequest): AsyncGenerator<string, void, unknown> {
    const text = await this.generate(request);
    
    // Simulate chunks for UX consistency
    const chunkSize = 10;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, i + chunkSize);
      // Tiny delay to allow UI updates
      await new Promise(r => setTimeout(r, 5));
    }
  }

  async generate(request: AIRequest): Promise<string> {
    const model = request.model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${request.apiKey}`;
    
    const payload: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    };
    
    if (request.systemPrompt) {
        payload.system_instruction = { parts: [{ text: request.systemPrompt }] };
    }

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