import { describe, it, expect, beforeEach } from "vitest";
import { toolRegistry } from "../registry";
import { pingTool } from "../examples/pingTool";

describe("ToolRegistry", () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  it("should register a tool", () => {
    toolRegistry.register(pingTool);
    expect(toolRegistry.has("ping")).toBe(true);
  });

  it("should throw error for duplicate tool names", () => {
    toolRegistry.register(pingTool);
    expect(() => toolRegistry.register(pingTool)).toThrow();
  });

  it("should retrieve tool by name", () => {
    toolRegistry.register(pingTool);
    const tool = toolRegistry.get("ping");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("ping");
  });

  it("should get all tools", () => {
    toolRegistry.register(pingTool);
    const tools = toolRegistry.getAll();
    expect(tools).toHaveLength(1);
  });

  it("should validate tool name format", () => {
    const invalidTool = { ...pingTool, name: "InvalidName" };
    expect(() => toolRegistry.register(invalidTool)).toThrow("snake_case");
  });
});
