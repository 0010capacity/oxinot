export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface IAIProvider {
  id: string;
  generateStream(request: AIRequest): AsyncGenerator<string, void, unknown>;
  generate(request: AIRequest): Promise<string>;
  getModels(baseUrl?: string, apiKey?: string): Promise<string[]>;
}
