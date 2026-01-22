import { tauriAPI, type SearchResult } from "../../tauri-api";
import { usePageStore } from "../../stores/pageStore";

// Logger utility
const createLogger = (moduleName: string) => {
  const prefix = `[${moduleName}]`;
  const isDev = import.meta.env.DEV;

  return {
    log: (...args: unknown[]) => {
      if (isDev) console.log(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
    debug: (...args: unknown[]) => {
      if (isDev) console.debug(prefix, ...args);
    },
    group: (label: string) => {
      if (isDev) console.group(prefix, label);
    },
    groupEnd: () => {
      if (isDev) console.groupEnd();
    },
    table: (data: unknown) => {
      if (isDev) console.table(data);
    },
  };
};

const logger = createLogger("pageTools");

/**
 * Tool definition for searching notes/pages
 * Used by AI copilot to find pages based on natural language queries
 */
export const searchNotesTool = {
  name: "search_notes",
  description:
    "Search for notes/pages by title or content. Returns a list of matching pages ranked by relevance.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The search query (keywords or natural language phrase). Example: 'project planning', '회의록', 'meeting notes'",
      },
    },
    required: ["query"],
  },
};

/**
 * Tool definition for opening a page by ID
 * Used by AI copilot to navigate to a specific page
 */
export const openPageTool = {
  name: "open_page",
  description:
    "Open a specific page/note by its ID. Use this after search_notes to navigate to a page.",
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description:
          "The unique ID of the page to open. Obtain this from search_notes results.",
      },
    },
    required: ["pageId"],
  },
};

/**
 * Tool executor for search_notes
 * Searches for pages matching the query and returns results with snippets
 */
export async function executeSearchNotes(
  workspacePath: string,
  query: string,
): Promise<SearchResult[]> {
  logger.group("executeSearchNotes");
  logger.info("Starting search with query:", query);
  logger.log("Workspace path:", workspacePath);

  // Validate input
  if (!query || query.trim().length === 0) {
    logger.warn("Empty query received, returning empty results");
    logger.groupEnd();
    return [];
  }

  try {
    logger.info(`Calling tauriAPI.searchContent with query: "${query}"`);
    const startTime = performance.now();

    const results = await tauriAPI.searchContent(workspacePath, query);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    logger.info(`Search completed in ${duration}ms`);
    logger.info(`Total results received: ${results.length}`);

    if (results.length === 0) {
      logger.warn("No results found for query:", query);
      logger.groupEnd();
      return [];
    }

    // Return top 10 results, sorted by relevance
    const topResults = results.slice(0, 10);
    logger.info(`Returning top 10 results (total: ${results.length})`);
    logger.table(
      topResults.map((r) => ({
        pageTitle: r.pageTitle,
        resultType: r.resultType,
        rank: r.rank,
        snippet: r.snippet.substring(0, 50) + "...",
      })),
    );

    logger.groupEnd();
    return topResults;
  } catch (error) {
    logger.error("Search execution failed:");
    logger.error("Error details:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error message:", errorMessage);
    logger.groupEnd();

    throw new Error(
      `Failed to search notes: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Tool executor for open_page
 * Opens a page by ID and updates the current page in the store
 */
export async function executeOpenPage(pageId: string): Promise<void> {
  logger.group("executeOpenPage");
  logger.info("Opening page with ID:", pageId);

  // Validate input
  if (!pageId) {
    logger.error("pageId is empty or undefined");
    logger.groupEnd();
    throw new Error("pageId is required");
  }

  try {
    logger.info("Getting page store instance");
    const pageStore = usePageStore.getState();
    logger.log("Page store obtained successfully");

    logger.info(`Calling pageStore.openPageById("${pageId}")`);
    const startTime = performance.now();

    await pageStore.openPageById(pageId);

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    logger.info(`✓ Page opened successfully in ${duration}ms`);

    // Verify page was actually opened
    const currentPageId = usePageStore.getState().currentPageId;
    if (currentPageId === pageId) {
      logger.info(
        `✓ Verification successful: currentPageId matches "${pageId}"`,
      );
    } else {
      logger.warn(`✗ Verification failed: currentPageId is "${currentPageId}"`);
    }

    logger.groupEnd();
  } catch (error) {
    logger.error("Page opening failed:");
    logger.error("Error details:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error message:", errorMessage);
    logger.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    logger.groupEnd();

    throw new Error(
      `Failed to open page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Process tool calls from AI responses
 * Handles both search_notes and open_page tool invocations
 */
export async function processPageToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  workspacePath: string,
): Promise<unknown> {
  logger.group(`processPageToolCall - ${toolName}`);
  logger.info(`Tool: ${toolName}`);
  logger.log("Input:", toolInput);
  logger.log("Workspace:", workspacePath);

  switch (toolName) {
    case "search_notes": {
      logger.info("Processing search_notes tool call");
      const query = toolInput.query as string;

      if (!query) {
        logger.error("Missing required parameter: query");
        logger.groupEnd();
        throw new Error("query parameter is required for search_notes");
      }

      logger.log("Query parameter validated:", query);

      try {
        logger.info("Executing search...");
        const results = await executeSearchNotes(workspacePath, query);

        const response = {
          success: true,
          results: results.map((r) => ({
            id: r.id,
            pageId: r.pageId,
            pageTitle: r.pageTitle,
            resultType: r.resultType,
            snippet: r.snippet,
            rank: r.rank,
          })),
          count: results.length,
        };

        logger.info(`✓ search_notes completed successfully`);
        logger.info(`Returning ${results.length} results`);
        logger.log("Response:", response);
        logger.groupEnd();

        return response;
      } catch (error) {
        logger.error("search_notes execution error:", error);
        logger.groupEnd();
        throw error;
      }
    }

    case "open_page": {
      logger.info("Processing open_page tool call");
      const pageId = toolInput.pageId as string;

      if (!pageId) {
        logger.error("Missing required parameter: pageId");
        logger.groupEnd();
        throw new Error("pageId parameter is required for open_page");
      }

      logger.log("pageId parameter validated:", pageId);

      try {
        logger.info("Executing page open...");
        await executeOpenPage(pageId);

        const response = {
          success: true,
          message: `Page ${pageId} opened successfully`,
        };

        logger.info(`✓ open_page completed successfully`);
        logger.log("Response:", response);
        logger.groupEnd();

        return response;
      } catch (error) {
        logger.error("open_page execution error:", error);
        logger.groupEnd();
        throw error;
      }
    }

    default: {
      logger.error(`Unknown tool: ${toolName}`);
      logger.groupEnd();
      throw new Error(`Unknown page tool: ${toolName}`);
    }
  }
}

/**
 * Get all page-related tools
 * Returns an array of tool definitions for AI copilot
 */
export function getPageTools() {
  logger.log("getPageTools() called");
  logger.log("Returning tools:", [searchNotesTool.name, openPageTool.name]);
  return [searchNotesTool, openPageTool];
}
