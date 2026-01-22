/**
 * Unit tests for tool executor
 * Tests ToolExecutor class and processAIResponse function
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor, processAIResponse } from "../toolExecutor";
import * as pageTools from "../pageTools";

// Mock page tools module
vi.mock("../pageTools", () => ({
  processPageToolCall: vi.fn(),
}));

describe("ToolExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should execute search_notes tool", async () => {
      const mockResult = {
        success: true,
        results: [],
        count: 0,
      };

      vi.mocked(pageTools.processPageToolCall).mockResolvedValue(mockResult);

      const result = await ToolExecutor.execute(
        "search_notes",
        { query: "test" },
        "/workspace",
      );

      expect(pageTools.processPageToolCall).toHaveBeenCalledWith(
        "search_notes",
        { query: "test" },
        "/workspace",
      );
      expect(result).toEqual(mockResult);
    });

    it("should execute open_page tool", async () => {
      const mockResult = {
        success: true,
        message: "Page opened successfully",
      };

      vi.mocked(pageTools.processPageToolCall).mockResolvedValue(mockResult);

      const result = await ToolExecutor.execute(
        "open_page",
        { pageId: "page-123" },
        "/workspace",
      );

      expect(pageTools.processPageToolCall).toHaveBeenCalledWith(
        "open_page",
        { pageId: "page-123" },
        "/workspace",
      );
      expect(result).toEqual(mockResult);
    });

    it("should throw error for unknown tool", async () => {
      await expect(
        ToolExecutor.execute("unknown_tool", {}, "/workspace"),
      ).rejects.toThrow("Unknown tool: unknown_tool");
    });

    it("should throw error for unimplemented tool", async () => {
      // Even if tool is registered but not implemented in execute switch
      await expect(
        ToolExecutor.execute("search_notes", { query: "test" }, "/workspace"),
      ).rejects.not.toThrow("Unknown tool");
    });
  });

  describe("validateToolInput", () => {
    it("should return true for valid search_notes input", () => {
      const isValid = ToolExecutor.validateToolInput("search_notes", {
        query: "test",
      });
      expect(isValid).toBe(true);
    });

    it("should return false for missing required query parameter", () => {
      const isValid = ToolExecutor.validateToolInput("search_notes", {});
      expect(isValid).toBe(false);
    });

    it("should return true for valid open_page input", () => {
      const isValid = ToolExecutor.validateToolInput("open_page", {
        pageId: "page-123",
      });
      expect(isValid).toBe(true);
    });

    it("should return false for missing required pageId parameter", () => {
      const isValid = ToolExecutor.validateToolInput("open_page", {});
      expect(isValid).toBe(false);
    });

    it("should return false for unknown tool", () => {
      const isValid = ToolExecutor.validateToolInput("unknown_tool", {
        param: "value",
      });
      expect(isValid).toBe(false);
    });

    it("should accept extra parameters", () => {
      const isValid = ToolExecutor.validateToolInput("search_notes", {
        query: "test",
        extraParam: "extra",
      });
      expect(isValid).toBe(true);
    });
  });

  describe("getToolsForAPI", () => {
    it("should return array of tools in Claude API format", () => {
      const tools = ToolExecutor.getToolsForAPI();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("input_schema");
        expect(tool.input_schema).toHaveProperty("type");
        expect(tool.input_schema).toHaveProperty("properties");
      }
    });

    it("should include search_notes tool", () => {
      const tools = ToolExecutor.getToolsForAPI();
      const searchNotesTool = tools.find((t) => t.name === "search_notes");

      expect(searchNotesTool).toBeDefined();
      expect(searchNotesTool?.description).toContain("Search");
    });

    it("should include open_page tool", () => {
      const tools = ToolExecutor.getToolsForAPI();
      const openPageTool = tools.find((t) => t.name === "open_page");

      expect(openPageTool).toBeDefined();
      expect(openPageTool?.description).toContain("Open");
    });
  });

  describe("getTool", () => {
    it("should return tool definition for search_notes", () => {
      const tool = ToolExecutor.getTool("search_notes");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("search_notes");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should return tool definition for open_page", () => {
      const tool = ToolExecutor.getTool("open_page");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("open_page");
      expect(tool?.inputSchema).toBeDefined();
    });

    it("should return undefined for unknown tool", () => {
      const tool = ToolExecutor.getTool("unknown_tool");
      expect(tool).toBeUndefined();
    });
  });
});

describe("processAIResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process text content", async () => {
    const response = {
      content: [
        {
          type: "text",
          text: "Hello, I will search for notes.",
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      type: "text",
      content: "Hello, I will search for notes.",
    });
  });

  it("should process tool use blocks", async () => {
    const mockToolResult = {
      success: true,
      results: [{ id: "1", pageId: "page-1", pageTitle: "Test" }],
      count: 1,
    };

    vi.mocked(pageTools.processPageToolCall).mockResolvedValue(mockToolResult);

    const response = {
      content: [
        {
          type: "tool_use",
          name: "search_notes",
          input: { query: "test" },
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("tool_result");
    expect(results[0].toolName).toBe("search_notes");
    expect(JSON.parse(results[0].content)).toEqual(mockToolResult);
  });

  it("should handle mixed text and tool use blocks", async () => {
    const mockToolResult = {
      success: true,
      results: [],
      count: 0,
    };

    vi.mocked(pageTools.processPageToolCall).mockResolvedValue(mockToolResult);

    const response = {
      content: [
        {
          type: "text",
          text: "I'll search for notes.",
        },
        {
          type: "tool_use",
          name: "search_notes",
          input: { query: "test" },
        },
        {
          type: "text",
          text: "No results found.",
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(3);
    expect(results[0].type).toBe("text");
    expect(results[1].type).toBe("tool_result");
    expect(results[2].type).toBe("text");
  });

  it("should handle tool use validation errors", async () => {
    const response = {
      content: [
        {
          type: "tool_use",
          name: "search_notes",
          input: {}, // Missing required 'query' parameter
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("tool_error");
    expect(results[0].content).toContain("Invalid input");
  });

  it("should handle tool execution errors", async () => {
    vi.mocked(pageTools.processPageToolCall).mockRejectedValue(
      new Error("Search failed"),
    );

    const response = {
      content: [
        {
          type: "tool_use",
          name: "search_notes",
          input: { query: "test" },
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("tool_error");
    expect(results[0].content).toContain("Tool execution failed");
  });

  it("should skip empty content blocks", async () => {
    const response = {
      content: [
        {
          type: "text",
          text: "Hello",
        },
        {
          type: "unknown",
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("text");
  });

  it("should handle multiple tool calls in sequence", async () => {
    const mockSearchResult = {
      success: true,
      results: [{ id: "1", pageId: "page-1", pageTitle: "Test" }],
      count: 1,
    };

    const mockOpenResult = {
      success: true,
      message: "Page opened",
    };

    vi.mocked(pageTools.processPageToolCall)
      .mockResolvedValueOnce(mockSearchResult)
      .mockResolvedValueOnce(mockOpenResult);

    const response = {
      content: [
        {
          type: "tool_use",
          name: "search_notes",
          input: { query: "test" },
        },
        {
          type: "tool_use",
          name: "open_page",
          input: { pageId: "page-1" },
        },
      ],
    };

    const results = await processAIResponse(response, "/workspace");

    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("tool_result");
    expect(results[1].type).toBe("tool_result");
    expect(pageTools.processPageToolCall).toHaveBeenCalledTimes(2);
  });
});
