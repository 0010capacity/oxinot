import { z } from "zod";
import type { Tool, ToolResult } from "../types";

export const pingTool: Tool = {
  name: "ping",
  description:
    "Test tool that responds with pong. Use this to verify tool system is working.",
  category: "test",
  requiresApproval: false,

  parameters: z.object({
    message: z
      .string()
      .optional()
      .describe("Optional message to include in response"),
  }),

  async execute(params, _context): Promise<ToolResult<string>> {
    try {
      const { message } = params;
      const response = message ? `pong: ${message}` : "pong";

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
