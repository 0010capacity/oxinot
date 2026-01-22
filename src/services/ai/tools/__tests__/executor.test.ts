import { describe, it, expect, beforeEach } from "vitest";
import { executeTool } from "../executor";
import { toolRegistry } from "../registry";
import { pingTool } from "../examples/pingTool";

describe("Tool Executor", () => {
  const mockContext = {
    workspacePath: "/test/workspace",
  };

  beforeEach(() => {
    toolRegistry.clear();
    toolRegistry.register(pingTool);
  });

  it("should execute tool with valid parameters", async () => {
    const result = await executeTool("ping", { message: "test" }, mockContext);
    expect(result.success).toBe(true);
    expect(result.data).toBe("pong: test");
  });

  it("should return error for non-existent tool", async () => {
    const result = await executeTool("nonexistent", {}, mockContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should validate parameters", async () => {
    const result = await executeTool(
      "ping",
      { message: 123 }, // Should be string
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid parameters");
  });
});
