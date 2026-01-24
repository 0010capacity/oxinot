import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "./types";

/**
 * Convert tool definition to format expected by AI providers
 */
export function toolToAIFunction(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.parameters, {
      target: "openApi3",
      $refStrategy: "none",
    }),
  };
}

/**
 * Convert multiple tools to AI function format
 */
export function toolsToAIFunctions(tools: Tool[]) {
  return tools.map(toolToAIFunction);
}

/**
 * Convert tools to modern OpenAI tools API format
 */
export function toolsToOpenAITools(tools: Tool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: toolToAIFunction(tool),
  }));
}
