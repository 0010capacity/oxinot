import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { useBlockStore } from "../../../../stores/blockStore";
import { usePageStore } from "../../../../stores/pageStore";
import { useViewStore } from "../../../../stores/viewStore";

export const openPageTool: Tool = {
  name: "open_page",
  description:
    'Open a page by its UUID or title. Use this when the user asks to "open", "go to", "navigate to", or "show" a specific page.',
  category: "page",
  requiresApproval: false, // Navigation is non-destructive

  parameters: z.union([
    z.object({
      pageId: z.string().uuid().describe("UUID of the page to open"),
    }),
    z.object({
      pageTitle: z.string().describe("Title of the page to open"),
    }),
  ]),

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();
    console.log("=".repeat(80));
    console.log("[openPageTool] EXECUTE STARTED at", new Date().toISOString());
    console.log("[openPageTool] Raw params received:", params);

    try {
      // Determine which param was provided
      let targetPageId: string | undefined =
        "pageId" in params ? params.pageId : undefined;
      const pageTitle = "pageTitle" in params ? params.pageTitle : undefined;

      console.log("[openPageTool] Parameter Analysis:");
      console.log(`  - pageId provided: ${!!targetPageId} (${targetPageId})`);
      console.log(`  - pageTitle provided: ${!!pageTitle} (${pageTitle})`);

      // If title provided instead of ID, search for page by title
      if (!targetPageId && pageTitle) {
        console.log(
          `[openPageTool] Searching for page by title: "${pageTitle}"`
        );

        const pageStore = usePageStore.getState();
        console.log(
          `[openPageTool] PageStore has ${
            Object.keys(pageStore.pagesById).length
          } pages`
        );

        // Log all available pages for debugging
        const allPages = Object.values(pageStore.pagesById);
        console.log("[openPageTool] Available pages:");
        allPages.forEach((page) => {
          console.log(
            `  - ID: ${page.id}, Title: "${page.title}", Match: ${
              page.title.toLowerCase() === pageTitle.toLowerCase()
            }`
          );
        });

        // Find page by exact title match (case-insensitive)
        const matchingPage = allPages.find(
          (page) => page.title.toLowerCase() === pageTitle.toLowerCase()
        );

        if (!matchingPage) {
          console.warn(
            `[openPageTool] ✗ No page found matching title "${pageTitle}"`
          );
          const duration = performance.now() - startTime;
          console.log(`[openPageTool] Duration: ${duration.toFixed(2)}ms`);
          console.log("=".repeat(80));
          return {
            success: false,
            error: `Page with title "${pageTitle}" not found`,
          };
        }

        targetPageId = matchingPage.id;
        console.log(
          `[openPageTool] ✓ Found page with ID: ${targetPageId}, Title: "${matchingPage.title}"`
        );
      }

      if (!targetPageId) {
        console.error(
          "[openPageTool] ✗ CRITICAL: No target page ID determined"
        );
        const duration = performance.now() - startTime;
        console.log(`[openPageTool] Duration: ${duration.toFixed(2)}ms`);
        console.log("=".repeat(80));
        return {
          success: false,
          error: "No page ID or title provided",
        };
      }

      console.log(
        `[openPageTool] TARGET PAGE ID: ${targetPageId}`,
        `Title: ${pageTitle || "N/A"}`
      );

      // ========== STEP 1: Get current state ==========
      console.log("\n--- STEP 1: Get Current State ---");
      const blockStoreBefore = useBlockStore.getState();
      const pageStoreBefore = usePageStore.getState();

      console.log("[openPageTool] BEFORE update:");
      console.log(
        `  - blockStore.currentPageId: ${blockStoreBefore.currentPageId}`
      );
      console.log(
        `  - pageStore.currentPageId: ${pageStoreBefore.currentPageId}`
      );
      console.log(
        `  - pageStore has page: ${!!pageStoreBefore.pagesById[targetPageId]}`
      );

      if (pageStoreBefore.pagesById[targetPageId]) {
        console.log(
          `  - page title: "${pageStoreBefore.pagesById[targetPageId].title}"`
        );
      }

      // ========== STEP 2: Load blocks via blockStore ==========
      console.log("\n--- STEP 2: Load Blocks via blockStore ---");
      try {
        console.log(
          `[openPageTool] Calling blockStore.openPage(${targetPageId})...`
        );
        await blockStoreBefore.openPage(targetPageId);
        console.log(`[openPageTool] ✓ blockStore.openPage() completed`);

        const blockStoreAfterBlockLoad = useBlockStore.getState();
        console.log("[openPageTool] After blockStore.openPage():");
        console.log(
          `  - blockStore.currentPageId: ${blockStoreAfterBlockLoad.currentPageId}`
        );
        const blockIds = Object.keys(blockStoreAfterBlockLoad.blocksById);
        console.log(`  - blockStore has blocks: ${blockIds.length} blocks`);
        if (blockIds.length > 0) {
          console.log(`  - First block: ${blockIds[0]}`);
        }
      } catch (blockError) {
        console.error(
          "[openPageTool] ✗ ERROR in blockStore.openPage():",
          blockError instanceof Error ? blockError.message : blockError
        );
        const duration = performance.now() - startTime;
        console.log(`[openPageTool] Duration: ${duration.toFixed(2)}ms`);
        console.log("=".repeat(80));
        return {
          success: false,
          error: `Failed to load blocks: ${
            blockError instanceof Error ? blockError.message : "Unknown error"
          }`,
        };
      }

      // ========== STEP 3: Update pageStore currentPageId ==========
      console.log("\n--- STEP 3: Update pageStore.currentPageId ---");
      try {
        const pageStore = usePageStore.getState();
        console.log(
          `[openPageTool] Calling pageStore.setCurrentPageId(${targetPageId})...`
        );
        pageStore.setCurrentPageId(targetPageId);
        console.log(`[openPageTool] ✓ pageStore.setCurrentPageId() completed`);

        const pageStoreAfterUpdate = usePageStore.getState();
        console.log("[openPageTool] After pageStore.setCurrentPageId():");
        console.log(
          `  - pageStore.currentPageId: ${pageStoreAfterUpdate.currentPageId}`
        );
      } catch (pageError) {
        console.error(
          "[openPageTool] ✗ ERROR in pageStore.setCurrentPageId():",
          pageError instanceof Error ? pageError.message : pageError
        );
        const duration = performance.now() - startTime;
        console.log(`[openPageTool] Duration: ${duration.toFixed(2)}ms`);
        console.log("=".repeat(80));
        return {
          success: false,
          error: `Failed to update page store: ${
            pageError instanceof Error ? pageError.message : "Unknown error"
          }`,
        };
      }

      // ========== STEP 4: Verify synchronization ==========
      console.log("\n--- STEP 4: Verify Store Synchronization ---");
      const blockStoreAfter = useBlockStore.getState();
      const pageStoreAfter = usePageStore.getState();

      console.log("[openPageTool] AFTER all updates:");
      console.log(
        `  - blockStore.currentPageId: ${blockStoreAfter.currentPageId}`
      );
      console.log(
        `  - pageStore.currentPageId: ${pageStoreAfter.currentPageId}`
      );

      const blockStoreSync = blockStoreAfter.currentPageId === targetPageId;
      const pageStoreSync = pageStoreAfter.currentPageId === targetPageId;

      console.log("[openPageTool] Synchronization Check:");
      console.log(`  - blockStore matches target: ${blockStoreSync}`);
      console.log(`  - pageStore matches target: ${pageStoreSync}`);
      console.log(`  - Both synchronized: ${blockStoreSync && pageStoreSync}`);

      if (!blockStoreSync) {
        console.warn(
          `[openPageTool] ⚠️ blockStore mismatch: expected ${targetPageId}, got ${blockStoreAfter.currentPageId}`
        );
      }
      if (!pageStoreSync) {
        console.warn(
          `[openPageTool] ⚠️ pageStore mismatch: expected ${targetPageId}, got ${pageStoreAfter.currentPageId}`
        );
      }

      // ========== STEP 5: Verify page exists and get info ==========
      console.log("\n--- STEP 5: Get Page Information ---");
      const targetPage = pageStoreAfter.pagesById[targetPageId];

      if (!targetPage) {
        console.warn(
          `[openPageTool] ⚠️ Page ${targetPageId} not found in pagesById`
        );
      } else {
        console.log(`[openPageTool] ✓ Page found: "${targetPage.title}"`);
      }

      const pageTitle_result = targetPage?.title || "Unknown";

      // ========== SUCCESS RESPONSE ==========
      console.log("\n--- SUCCESS RESPONSE ---");

      // Update viewStore which triggers proper navigation flow
      // Build parent page chain for breadcrumb
      try {
        const viewStore = useViewStore.getState();
        const pageStore = usePageStore.getState();

        // Extract workspace name from context workspacePath
        // The context includes workspacePath like "/Users/won/Documents/TESTS/C"
        const workspaceName =
          context?.workspacePath?.split("/").pop() || "Workspace";

        console.log(
          `[openPageTool] Setting workspace name: "${workspaceName}"`
        );
        viewStore.setWorkspaceName(workspaceName);
        console.log(`[openPageTool] ✓ Workspace name set`);

        console.log(
          "[openPageTool] Building parent page chain for breadcrumb..."
        );

        // Build parent names and page path IDs for breadcrumb
        const parentNames: string[] = [];
        const pagePathIds: string[] = [];

        let currentId: string | undefined = targetPageId;
        const visitedIds = new Set<string>(); // Prevent infinite loops

        while (currentId && !visitedIds.has(currentId)) {
          visitedIds.add(currentId);
          const page: (typeof pageStore.pagesById)[string] | undefined =
            pageStore.pagesById[currentId];
          if (!page) {
            console.warn(`[openPageTool] Parent page not found: ${currentId}`);
            break;
          }

          pagePathIds.unshift(currentId);
          if (currentId !== targetPageId) {
            // Don't include the target page itself in parent names
            parentNames.unshift(page.title);
          }

          currentId = page.parentId;
        }

        console.log(
          `[openPageTool] Built breadcrumb: parentNames=[${parentNames
            .map((n) => `"${n}"`)
            .join(", ")}], pagePathIds=[${pagePathIds
            .map((id) => id.slice(0, 8))
            .join(", ")}]`
        );

        // Use openNote which properly updates breadcrumb, instead of showPage
        console.log(
          `[openPageTool] Calling viewStore.openNote() with full breadcrumb...`
        );
        viewStore.openNote(
          targetPageId,
          pageTitle_result,
          parentNames,
          pagePathIds
        );
        console.log("[openPageTool] ✓ viewStore.openNote() completed");
      } catch (viewError) {
        console.warn(
          "[openPageTool] ⚠️ Warning updating viewStore:",
          viewError instanceof Error ? viewError.message : viewError
        );
      }

      // Dispatch custom event to notify UI of page change
      try {
        const pageChangeEvent = new CustomEvent("ai_page_opened", {
          detail: {
            pageId: targetPageId,
            pageTitle: pageTitle_result,
          },
        });
        window.dispatchEvent(pageChangeEvent);
        console.log("[openPageTool] ✓ Dispatched ai_page_opened event");
      } catch (eventError) {
        console.warn(
          "[openPageTool] ⚠️ Warning dispatching event:",
          eventError instanceof Error ? eventError.message : eventError
        );
      }

      const result: ToolResult = {
        success: true,
        data: {
          pageId: targetPageId,
          pageTitle: pageTitle_result,
          message: `Successfully opened page "${pageTitle_result}"`,
          blockStoreSync,
          pageStoreSync,
          blockCount: Object.keys(blockStoreAfter.blocksById).length,
        },
      };

      console.log("[openPageTool] ✓ Returning success result:", result);

      const duration = performance.now() - startTime;
      console.log(`\n[openPageTool] Total Duration: ${duration.toFixed(2)}ms`);
      console.log("=".repeat(80));

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack =
        error instanceof Error ? error.stack : "No stack trace";

      console.error("=".repeat(80));
      console.error(`[openPageTool] ✗ FATAL ERROR: ${errorMessage}`);
      console.error("[openPageTool] Stack trace:", errorStack);
      console.error("[openPageTool] Error object:", error);

      const duration = performance.now() - startTime;
      console.log(`[openPageTool] Duration: ${duration.toFixed(2)}ms`);
      console.log("=".repeat(80));

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};
