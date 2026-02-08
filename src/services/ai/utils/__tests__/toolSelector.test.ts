import { toolRegistry } from "@/services/ai/tools/registry";
import type { Tool } from "@/services/ai/tools/types";
import { ToolCategory } from "@/services/ai/tools/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  getToolsByCategory,
  isDangerousTool,
  isSafeTool,
  selectToolsByIntent,
} from "../toolSelector";

const createMockTool = (overrides: Partial<Tool> = {}): Tool => ({
  name: "test_tool",
  description: "Test tool",
  parameters: z.object({}),
  execute: vi.fn(),
  ...overrides,
});

describe("toolSelector", () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  describe("selectToolsByIntent - CONVERSATIONAL", () => {
    it("returns empty array for conversational intent", () => {
      const tools = selectToolsByIntent("CONVERSATIONAL");
      expect(tools).toEqual([]);
    });
  });

  describe("selectToolsByIntent - INFORMATION_REQUEST", () => {
    it("returns read-only tools for information requests", () => {
      const readOnlyTools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "query_blocks" }),
        createMockTool({ name: "list_pages" }),
      ];

      for (const tool of readOnlyTools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("INFORMATION_REQUEST");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("get_block");
      expect(selectedNames).toContain("query_blocks");
      expect(selectedNames).toContain("list_pages");
    });

    it("does not include creation or deletion tools", () => {
      const allTools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "delete_block" }),
      ];

      for (const tool of allTools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("INFORMATION_REQUEST");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("get_block");
      expect(selectedNames).not.toContain("create_block");
      expect(selectedNames).not.toContain("delete_block");
    });
  });

  describe("selectToolsByIntent - CONTENT_CREATION", () => {
    it("includes read and create tools", () => {
      const tools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "create_blocks_from_markdown" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("CONTENT_CREATION");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("get_block");
      expect(selectedNames).toContain("create_block");
      expect(selectedNames).toContain("create_blocks_from_markdown");
    });

    it("does not include deletion tools", () => {
      const tools = [
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "delete_block" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("CONTENT_CREATION");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("create_block");
      expect(selectedNames).not.toContain("delete_block");
    });

    it("includes update/append tools", () => {
      const tools = [
        createMockTool({ name: "update_block" }),
        createMockTool({ name: "append_to_block" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("CONTENT_CREATION");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("update_block");
      expect(selectedNames).toContain("append_to_block");
    });
  });

  describe("selectToolsByIntent - CONTENT_MODIFICATION", () => {
    it("includes all tools including delete", () => {
      const tools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "update_block" }),
        createMockTool({ name: "delete_block" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const selected = selectToolsByIntent("CONTENT_MODIFICATION");
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("get_block");
      expect(selectedNames).toContain("create_block");
      expect(selectedNames).toContain("update_block");
      expect(selectedNames).toContain("delete_block");
    });

    it("is superset of CONTENT_CREATION tools", () => {
      const tools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "delete_block" }),
        createMockTool({ name: "update_block" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const creationTools = selectToolsByIntent("CONTENT_CREATION");
      const modificationTools = selectToolsByIntent("CONTENT_MODIFICATION");

      const creationNames = creationTools.map((t) => t.name);
      const modificationNames = modificationTools.map((t) => t.name);

      for (const name of creationNames) {
        expect(modificationNames).toContain(name);
      }
    });
  });

  describe("getToolsByCategory", () => {
    it("returns tools matching category", () => {
      const blockTools = [
        createMockTool({
          name: "get_block",
          category: ToolCategory.BLOCK,
        }),
        createMockTool({
          name: "create_block",
          category: ToolCategory.BLOCK,
        }),
      ];

      const pageTools = [
        createMockTool({ name: "list_pages", category: ToolCategory.PAGE }),
      ];

      for (const tool of [...blockTools, ...pageTools]) {
        toolRegistry.register(tool);
      }

      const selected = getToolsByCategory(ToolCategory.BLOCK);
      const selectedNames = selected.map((t) => t.name);

      expect(selectedNames).toContain("get_block");
      expect(selectedNames).toContain("create_block");
      expect(selectedNames).not.toContain("list_pages");
    });

    it("returns empty array for category with no tools", () => {
      const selected = getToolsByCategory(ToolCategory.NAVIGATION);
      expect(selected).toEqual([]);
    });
  });

  describe("isSafeTool", () => {
    it("identifies read-only tools as safe", () => {
      const safeTools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "query_blocks" }),
        createMockTool({ name: "list_pages" }),
      ];

      for (const tool of safeTools) {
        expect(isSafeTool(tool)).toBe(true);
      }
    });

    it("identifies modification tools as unsafe", () => {
      const unsafeTools = [
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "update_block" }),
        createMockTool({ name: "delete_block" }),
      ];

      for (const tool of unsafeTools) {
        expect(isSafeTool(tool)).toBe(false);
      }
    });

    it("uses isDangerous flag from tool", () => {
      const tool = createMockTool({
        name: "custom_tool",
        isDangerous: true,
      });

      expect(isSafeTool(tool)).toBe(false);
    });
  });

  describe("isDangerousTool", () => {
    it("identifies destructive tools as dangerous", () => {
      const dangerousTools = [
        createMockTool({ name: "delete_block", isDangerous: true }),
        createMockTool({ name: "delete_page", isDangerous: true }),
      ];

      for (const tool of dangerousTools) {
        expect(isDangerousTool(tool)).toBe(true);
      }
    });

    it("identifies safe tools as not dangerous", () => {
      const safeTools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "list_pages" }),
      ];

      for (const tool of safeTools) {
        expect(isDangerousTool(tool)).toBe(false);
      }
    });

    it("respects isDangerous flag", () => {
      const markedDangerous = createMockTool({
        name: "custom_delete",
        isDangerous: true,
      });
      const notMarked = createMockTool({
        name: "custom_get",
        isDangerous: false,
      });

      expect(isDangerousTool(markedDangerous)).toBe(true);
      expect(isDangerousTool(notMarked)).toBe(false);
    });
  });

  describe("Tool Selection Hierarchy", () => {
    it("follows intent hierarchy: CONVERSATIONAL < INFORMATION < CREATION < MODIFICATION", () => {
      const tools = [
        createMockTool({ name: "get_block" }),
        createMockTool({ name: "create_block" }),
        createMockTool({ name: "delete_block" }),
        createMockTool({ name: "update_block" }),
      ];

      for (const tool of tools) {
        toolRegistry.register(tool);
      }

      const conv = selectToolsByIntent("CONVERSATIONAL");
      const info = selectToolsByIntent("INFORMATION_REQUEST");
      const creation = selectToolsByIntent("CONTENT_CREATION");
      const modification = selectToolsByIntent("CONTENT_MODIFICATION");

      expect(conv.length).toBeLessThan(info.length);
      expect(info.length).toBeLessThan(creation.length);
      expect(creation.length).toBeLessThan(modification.length);
    });
  });
});
