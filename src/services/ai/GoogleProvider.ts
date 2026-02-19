import { fetch } from "@tauri-apps/plugin-http";
import { toolsToAIFunctions } from "./tools/utils";
import type { AIRequest, IAIProvider, StreamChunk } from "./types";

interface GooglePart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
}

interface GoogleContent {
  role: string;
  parts: GooglePart[];
}

export class GoogleProvider implements IAIProvider {
  id = "google";
  private abortController: AbortController | null = null;

  async *generateStream(
    request: AIRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.abortController = new AbortController();

    try {
      const contents = this.buildContents(request);
      const model = request.model || "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${request.apiKey}`;

      const payload: Record<string, unknown> = {
        contents: contents,
        generationConfig: {
          temperature: request.temperature ?? 0.3,
        },
      };

      if (request.systemPrompt) {
        payload.system_instruction = {
          parts: [{ text: request.systemPrompt }],
        };
      }

      if (request.tools && request.tools.length > 0) {
        const functions = toolsToAIFunctions(request.tools);
        payload.tools = [
          {
            function_declarations: functions.map((fn) => ({
              name: fn.name,
              description: fn.description,
              parameters: this.cleanSchemaForGemini(fn.parameters),
            })),
          },
        ];
      }

      console.log("[GoogleProvider] Sending to API:");
      console.log(
        "  System prompt:",
        `${request.systemPrompt?.substring(0, 100)}...`,
      );
      console.log("  Contents:", contents.length);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API Error (${response.status}): ${errText}`);
      }

      const json = await response.json();
      const parts = json.candidates?.[0]?.content?.parts || [];

      if (parts.length === 0) {
        return;
      }

      for (const part of parts) {
        if (part.functionCall) {
          yield {
            type: "tool_call",
            toolCall: {
              id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args || {},
            },
          };
        } else if (part.text) {
          const chunkSize = 10;
          for (let i = 0; i < part.text.length; i += chunkSize) {
            yield {
              type: "text",
              content: part.text.slice(i, i + chunkSize),
            };
            await new Promise((r) => setTimeout(r, 5));
          }
        }
      }
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("[GoogleProvider] Stream aborted");
        return;
      }
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private buildContents(request: AIRequest): GoogleContent[] {
    const contents: GoogleContent[] = [];

    if (request.history) {
      for (const msg of request.history) {
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role: role,
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: request.prompt }],
    });

    return contents;
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

  private cleanSchemaForGemini(
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!schema || typeof schema !== "object") {
      return schema;
    }

    const cleaned: Record<string, unknown> = {};

    if ("type" in schema) cleaned.type = schema.type;
    if ("description" in schema) cleaned.description = schema.description;
    if ("enum" in schema) cleaned.enum = schema.enum;
    if ("format" in schema) cleaned.format = schema.format;

    if (
      "properties" in schema &&
      schema.properties &&
      typeof schema.properties === "object"
    ) {
      cleaned.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        (cleaned.properties as Record<string, unknown>)[key] =
          this.cleanSchemaForGemini(value as Record<string, unknown>);
      }
    }

    if ("items" in schema && schema.items && typeof schema.items === "object") {
      cleaned.items = this.cleanSchemaForGemini(
        schema.items as Record<string, unknown>,
      );
    }

    if ("anyOf" in schema && Array.isArray(schema.anyOf)) {
      const allProps: Record<string, unknown> = {};
      const allRequired: string[] = [];

      for (const subSchema of schema.anyOf) {
        if (
          subSchema &&
          typeof subSchema === "object" &&
          "properties" in subSchema &&
          subSchema.properties &&
          typeof subSchema.properties === "object"
        ) {
          Object.assign(allProps, subSchema.properties);
        }
        if (
          subSchema &&
          typeof subSchema === "object" &&
          "required" in subSchema &&
          Array.isArray(subSchema.required)
        ) {
          allRequired.push(...subSchema.required);
        }
      }

      if (Object.keys(allProps).length > 0) {
        cleaned.type = "object";
        cleaned.properties = {};
        for (const [key, value] of Object.entries(allProps)) {
          (cleaned.properties as Record<string, unknown>)[key] =
            this.cleanSchemaForGemini(value as Record<string, unknown>);
        }
        if (allRequired.length > 0) {
          cleaned.required = [...new Set(allRequired)];
        }
      }
    } else if ("required" in schema) {
      cleaned.required = schema.required;
    }

    return cleaned;
  }

  abort(): void {
    this.abortController?.abort();
  }
}
