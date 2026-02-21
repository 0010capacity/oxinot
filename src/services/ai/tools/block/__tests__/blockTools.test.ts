import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBlockTool,
  deleteBlockTool,
  getBlockTool,
  queryBlocksTool,
  updateBlockTool,
} from "../";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock dispatchBlockUpdate (used by create/update/delete tools)
vi.mock("../../../../../events", () => ({
  dispatchBlockUpdate: vi.fn(),
}));

describe("Block Tools", () => {
  const mockContext = { workspacePath: "/test" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_block", () => {
    it("should get block successfully", async () => {
      const mockBlock = { id: "test-uuid", content: "test content" };
      vi.mocked(invoke).mockResolvedValue(mockBlock);

      const result = await getBlockTool.execute(
        { blockId: "test-uuid" },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlock);
      expect(invoke).toHaveBeenCalledWith("get_block", {
        workspacePath: "/test",
        request: { block_id: "test-uuid" },
      });
    });

    it("should handle block not found", async () => {
      vi.mocked(invoke).mockResolvedValue(null);

      const result = await getBlockTool.execute(
        { blockId: "nonexistent" },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("update_block", () => {
    it("should update block content", async () => {
      const mockUpdatedBlock = {
        id: "test-uuid",
        content: "new content",
        pageId: "page-1",
      };
      vi.mocked(invoke).mockResolvedValue(mockUpdatedBlock);

      const result = await updateBlockTool.execute(
        {
          blockId: "test-uuid",
          content: "new content",
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith("update_block", {
        workspacePath: "/test",
        request: {
          id: "test-uuid",
          content: "new content",
        },
      });
    });
  });

  describe("create_block", () => {
    it("should create block with pageId", async () => {
      const mockNewBlock = {
        id: "new-uuid",
        content: "new block",
        pageId: "550e8400-e29b-41d4-a716-446655440000",
      };
      vi.mocked(invoke).mockResolvedValue(mockNewBlock);

      const result = await createBlockTool.execute(
        {
          pageId: "550e8400-e29b-41d4-a716-446655440000",
          content: "new block",
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith("create_block", {
        workspacePath: "/test",
        request: {
          pageId: "550e8400-e29b-41d4-a716-446655440000",
          parentId: null,
          afterBlockId: null,
          content: "new block",
        },
      });
    });

    it("should fail when neither pageId nor parentBlockId provided", async () => {
      const result = await createBlockTool.execute(
        { content: "orphan block" },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("pageId or parentBlockId");
    });
  });

  describe("delete_block", () => {
    it("should delete block successfully", async () => {
      vi.mocked(invoke).mockResolvedValue(["deleted-uuid"]);

      const result = await deleteBlockTool.execute(
        { blockId: "deleted-uuid" },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith("delete_block", {
        workspacePath: "/test",
        blockId: "deleted-uuid",
      });
    });
  });

  describe("query_blocks", () => {
    it("should query blocks successfully", async () => {
      const mockBlocks = [{ id: "1", content: "result" }];
      vi.mocked(invoke).mockResolvedValue(mockBlocks);

      const result = await queryBlocksTool.execute(
        { query: "test", limit: 10 },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocks);
      expect(invoke).toHaveBeenCalledWith("search_blocks", {
        workspacePath: "/test",
        request: {
          query: "test",
          limit: 10,
        },
      });
    });
  });
});
