/**
 * Unit tests for page tools
 * Tests search_notes and open_page tool functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  executeSearchNotes,
  executeOpenPage,
  processPageToolCall,
} from "../pageTools";
import { tauriAPI } from "../../../tauri-api";
import { usePageStore } from "../../../stores/pageStore";

// Mock tauriAPI
vi.mock("../../../tauri-api", () => ({
  tauriAPI: {
    searchContent: vi.fn(),
  },
}));

// Mock pageStore
vi.mock("../../../stores/pageStore", () => ({
  usePageStore: {
    getState: vi.fn(),
  },
}));

describe("pageTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeSearchNotes", () => {
    it("should return empty array when query is empty", async () => {
      const result = await executeSearchNotes("/workspace", "");
      expect(result).toEqual([]);
    });

    it("should return empty array when query is whitespace only", async () => {
      const result = await executeSearchNotes("/workspace", "   ");
      expect(result).toEqual([]);
    });

    it("should call tauriAPI.searchContent with correct parameters", async () => {
      const mockResults = [
        {
          id: "1",
          pageId: "page-1",
          pageTitle: "Test Page",
          resultType: "page" as const,
          content: "Test content",
          snippet: "Test **content**",
          rank: 100.0,
        },
      ];

      vi.mocked(tauriAPI.searchContent).mockResolvedValue(mockResults);

      const result = await executeSearchNotes("/workspace", "test");

      expect(tauriAPI.searchContent).toHaveBeenCalledWith("/workspace", "test");
      expect(result).toEqual(mockResults);
    });

    it("should limit results to top 10", async () => {
      const mockResults = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        pageId: `page-${i}`,
        pageTitle: `Page ${i}`,
        resultType: "page" as const,
        content: `Content ${i}`,
        snippet: `Snippet ${i}`,
        rank: 100 - i,
      }));

      vi.mocked(tauriAPI.searchContent).mockResolvedValue(mockResults);

      const result = await executeSearchNotes("/workspace", "test");

      expect(result).toHaveLength(10);
      expect(result).toEqual(mockResults.slice(0, 10));
    });

    it("should throw error when tauriAPI fails", async () => {
      vi.mocked(tauriAPI.searchContent).mockRejectedValue(
        new Error("API Error"),
      );

      await expect(executeSearchNotes("/workspace", "test")).rejects.toThrow(
        "Failed to search notes",
      );
    });

    it("should handle multilingual queries", async () => {
      const mockResults = [
        {
          id: "1",
          pageId: "page-1",
          pageTitle: "會議紀錄",
          resultType: "page" as const,
          content: "Chinese meeting notes",
          snippet: "Chinese **meeting** notes",
          rank: 100.0,
        },
      ];

      vi.mocked(tauriAPI.searchContent).mockResolvedValue(mockResults);

      const result = await executeSearchNotes("/workspace", "會議紀錄");

      expect(tauriAPI.searchContent).toHaveBeenCalledWith(
        "/workspace",
        "會議紀錄",
      );
      expect(result).toEqual(mockResults);
    });
  });

  describe("executeOpenPage", () => {
    it("should call pageStore.openPageById with correct pageId", async () => {
      const mockOpenPageById = vi.fn().mockResolvedValue(undefined);
      vi.mocked(usePageStore.getState).mockReturnValue({
        openPageById: mockOpenPageById,
      } as unknown as ReturnType<typeof usePageStore.getState>);

      await executeOpenPage("page-123");

      expect(mockOpenPageById).toHaveBeenCalledWith("page-123");
    });

    it("should throw error when pageStore fails", async () => {
      vi.mocked(usePageStore.getState).mockReturnValue({
        openPageById: vi.fn().mockRejectedValue(new Error("Page not found")),
      } as unknown as ReturnType<typeof usePageStore.getState>);

      await expect(executeOpenPage("invalid-id")).rejects.toThrow(
        "Failed to open page",
      );
    });
  });

  describe("processPageToolCall", () => {
    describe("search_notes tool", () => {
      it("should execute search_notes and return results", async () => {
        const mockResults = [
          {
            id: "1",
            pageId: "page-1",
            pageTitle: "Test Page",
            resultType: "page" as const,
            content: "Test content",
            snippet: "Test **content**",
            rank: 100.0,
          },
        ];

        vi.mocked(tauriAPI.searchContent).mockResolvedValue(mockResults);

        const result = await processPageToolCall(
          "search_notes",
          { query: "test" },
          "/workspace",
        );

        expect(result).toEqual({
          success: true,
          results: expect.any(Array),
          count: 1,
        });
      });

      it("should throw error when query is missing", async () => {
        await expect(
          processPageToolCall("search_notes", {}, "/workspace"),
        ).rejects.toThrow("query parameter is required");
      });

      it("should return results formatted correctly", async () => {
        const mockResults = [
          {
            id: "1",
            pageId: "page-1",
            pageTitle: "Test Page",
            resultType: "page" as const,
            content: "Test content",
            snippet: "Test **content**",
            rank: 100.0,
          },
        ];

        vi.mocked(tauriAPI.searchContent).mockResolvedValue(mockResults);

        const result = (await processPageToolCall(
          "search_notes",
          { query: "test" },
          "/workspace",
        )) as Record<string, unknown>;

        expect((result.results as unknown[])[0]).toMatchObject({
          id: "1",
          pageId: "page-1",
          pageTitle: "Test Page",
          resultType: "page",
          snippet: expect.any(String),
          rank: 100.0,
        });
      });
    });

    describe("open_page tool", () => {
      it("should execute open_page and return success", async () => {
        const mockOpenPageById = vi.fn().mockResolvedValue(undefined);
        vi.mocked(usePageStore.getState).mockReturnValue({
          openPageById: mockOpenPageById,
        } as unknown as ReturnType<typeof usePageStore.getState>);

        const result = await processPageToolCall(
          "open_page",
          { pageId: "page-123" },
          "/workspace",
        );

        expect(result).toEqual({
          success: true,
          message: "Page page-123 opened successfully",
        });
      });

      it("should throw error when pageId is missing", async () => {
        await expect(
          processPageToolCall("open_page", {}, "/workspace"),
        ).rejects.toThrow("pageId parameter is required");
      });
    });

    describe("unknown tool", () => {
      it("should throw error for unknown tool", async () => {
        await expect(
          processPageToolCall("unknown_tool", {}, "/workspace"),
        ).rejects.toThrow("Unknown page tool");
      });
    });
  });
});
