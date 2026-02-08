import { z } from "zod";
import { useBlockStore } from "../../../../stores/blockStore";
import { usePageStore } from "../../../../stores/pageStore";
import { useViewStore } from "../../../../stores/viewStore";
import type { Tool, ToolResult } from "../types";

const LOG_PREFIX = "[openPageTool]";

async function resolvePageId(params: {
  pageId?: string;
  pageTitle?: string;
}): Promise<{ pageId: string | null; error?: string }> {
  const pageId = "pageId" in params ? params.pageId : undefined;
  const pageTitle = "pageTitle" in params ? params.pageTitle : undefined;

  if (pageId) {
    return { pageId };
  }

  if (!pageTitle) {
    return { pageId: null, error: "No page ID or title provided" };
  }

  const pageStore = usePageStore.getState();
  const allPages = Object.values(pageStore.pagesById);

  const matchingPage = allPages.find(
    (page) => page.title.toLowerCase() === pageTitle.toLowerCase(),
  );

  if (!matchingPage) {
    console.warn(`${LOG_PREFIX} No page found matching title "${pageTitle}"`);
    return {
      pageId: null,
      error: `Page with title "${pageTitle}" not found`,
    };
  }

  console.info(
    `${LOG_PREFIX} Resolved page title "${pageTitle}" to ID ${matchingPage.id}`,
  );
  return { pageId: matchingPage.id };
}

async function loadPageBlocks(
  pageId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const blockStore = useBlockStore.getState();
    await blockStore.openPage(pageId);
    const blockCount = Object.keys(useBlockStore.getState().blocksById).length;
    console.info(`${LOG_PREFIX} Loaded ${blockCount} blocks for page`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`${LOG_PREFIX} Failed to load blocks: ${message}`);
    return { success: false, error: `Failed to load blocks: ${message}` };
  }
}

async function updatePageStore(
  pageId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const pageStore = usePageStore.getState();
    pageStore.setCurrentPageId(pageId);
    console.info(`${LOG_PREFIX} Updated pageStore.currentPageId to ${pageId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`${LOG_PREFIX} Failed to update page store: ${message}`);
    return {
      success: false,
      error: `Failed to update page store: ${message}`,
    };
  }
}

function verifyStoreSync(pageId: string): {
  blockStoreSync: boolean;
  pageStoreSync: boolean;
} {
  const blockStore = useBlockStore.getState();
  const pageStore = usePageStore.getState();

  const blockStoreSync = blockStore.currentPageId === pageId;
  const pageStoreSync = pageStore.currentPageId === pageId;

  if (!blockStoreSync) {
    console.warn(
      `${LOG_PREFIX} blockStore mismatch: expected ${pageId}, got ${blockStore.currentPageId}`,
    );
  }
  if (!pageStoreSync) {
    console.warn(
      `${LOG_PREFIX} pageStore mismatch: expected ${pageId}, got ${pageStore.currentPageId}`,
    );
  }

  return { blockStoreSync, pageStoreSync };
}

interface PageStoreData {
  pagesById: Record<string, { id: string; title: string; parentId?: string }>;
}

function openPageInView(
  pageId: string,
  pageTitle: string,
  context?: Record<string, unknown>,
): { success: boolean; error?: string } {
  try {
    const viewStore = useViewStore.getState();
    const pageStore = usePageStore.getState() as unknown as PageStoreData;

    const workspaceName =
      (context?.workspacePath as string)?.split("/").pop() || "Workspace";
    viewStore.setWorkspaceName(workspaceName);

    const parentNames: string[] = [];
    const pagePathIds: string[] = [];
    let currentId: string | undefined = pageId;
    const visitedIds = new Set<string>();

    while (currentId && !visitedIds.has(currentId)) {
      visitedIds.add(currentId);
      const page: (typeof pageStore.pagesById)[string] | undefined =
        pageStore.pagesById[currentId];
      if (!page) break;

      pagePathIds.unshift(currentId);
      if (currentId !== pageId) {
        parentNames.unshift(page.title);
      }

      currentId = page.parentId;
    }

    viewStore.openNote(pageId, pageTitle, parentNames, pagePathIds);
    console.info(`${LOG_PREFIX} Opened page in view with breadcrumb`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`${LOG_PREFIX} Warning updating viewStore: ${message}`);
    return { success: false, error: message };
  }
}

function dispatchPageOpenedEvent(pageId: string, pageTitle: string): void {
  try {
    const event = new CustomEvent("ai_page_opened", {
      detail: { pageId, pageTitle },
    });
    window.dispatchEvent(event);
    console.info(`${LOG_PREFIX} Dispatched ai_page_opened event`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`${LOG_PREFIX} Warning dispatching event: ${message}`);
  }
}

export const openPageTool: Tool = {
  name: "open_page",
  description:
    'Open a page by its UUID or title. Use this when the user asks to "open", "go to", "navigate to", or "show" a specific page.',
  category: "page",
  requiresApproval: false,

  parameters: z.union([
    z.object({
      pageId: z
        .string()
        .uuid()
        .describe(
          "UUID of the page to open. Example: '550e8400-e29b-41d4-a716-446655440000'",
        ),
    }),
    z.object({
      pageTitle: z
        .string()
        .describe(
          "Title of the page to open. Will search for exact match (case-insensitive). Example: 'Project Notes'",
        ),
    }),
  ]),

  async execute(params, context): Promise<ToolResult> {
    const resolved = await resolvePageId(
      params as { pageId?: string; pageTitle?: string },
    );
    if (!resolved.pageId) {
      return { success: false, error: resolved.error };
    }

    const pageId = resolved.pageId;

    const blockResult = await loadPageBlocks(pageId);
    if (!blockResult.success) {
      return { success: false, error: blockResult.error };
    }

    const storeResult = await updatePageStore(pageId);
    if (!storeResult.success) {
      return { success: false, error: storeResult.error };
    }

    const { blockStoreSync, pageStoreSync } = verifyStoreSync(pageId);

    const pageStore = usePageStore.getState();
    const targetPage = pageStore.pagesById[pageId];
    const pageTitle = targetPage?.title || "Unknown";

    openPageInView(
      pageId,
      pageTitle,
      context as unknown as Record<string, unknown>,
    );
    dispatchPageOpenedEvent(pageId, pageTitle);

    const blockCount = Object.keys(useBlockStore.getState().blocksById).length;
    const result: ToolResult = {
      success: true,
      data: {
        pageId,
        pageTitle,
        message: `Successfully opened page "${pageTitle}"`,
        blockStoreSync,
        pageStoreSync,
        blockCount,
      },
    };

    console.info(`${LOG_PREFIX} Successfully completed`);
    return result;
  },
};
