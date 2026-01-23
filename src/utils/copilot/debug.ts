/**
 * Copilot Tools Debugging Utilities
 *
 * These utilities help test the copilot tools manually from the browser console.
 * Useful for verifying search and page opening functionality.
 *
 * Usage in browser console:
 * ```
 * import { debugSearchAndOpen, debugSearch, debugOpen } from '@/utils/copilot/debug';
 * await debugSearch("project planning");
 * ```
 */

import { executeSearchNotes, executeOpenPage } from "./pageTools";
import { ToolExecutor, processAIResponse } from "./toolExecutor";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { usePageStore } from "../../stores/pageStore";

/**
 * Test the search functionality
 * @param query - Search query to test
 */
export async function debugSearch(query: string): Promise<void> {
  const debugLogger = createDebugLogger("debugSearch");
  debugLogger.section("Testing Search Functionality");

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    debugLogger.error("No workspace selected");
    return;
  }

  try {
    debugLogger.info("Starting search test");
    debugLogger.keyValue("Query", query);
    debugLogger.keyValue("Workspace", workspacePath);

    const results = await executeSearchNotes(workspacePath, query);

    debugLogger.success("Search completed");
    debugLogger.keyValue("Results count", results.length);

    if (results.length === 0) {
      debugLogger.warn("No results found");
      return;
    }

    debugLogger.info("Top results:");
    debugLogger.table(
      results.map((r, idx) => ({
        rank: idx + 1,
        title: r.pageTitle,
        type: r.resultType,
        score: r.rank,
        snippet: `${r.snippet.substring(0, 50)}...`,
      }))
    );

    debugLogger.section("Full Results Details");
    results.forEach((result, idx) => {
      debugLogger.group(`Result ${idx + 1}`);
      debugLogger.keyValue("ID", result.id);
      debugLogger.keyValue("Page ID", result.pageId);
      debugLogger.keyValue("Title", result.pageTitle);
      debugLogger.keyValue("Type", result.resultType);
      debugLogger.keyValue("Score", result.rank);
      debugLogger.keyValue("Snippet", result.snippet);
      debugLogger.groupEnd();
    });
  } catch (error) {
    debugLogger.error("Search test failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Test the open page functionality
 * @param pageId - Page ID to open
 */
export async function debugOpen(pageId: string): Promise<void> {
  const debugLogger = createDebugLogger("debugOpen");
  debugLogger.section("Testing Open Page Functionality");

  try {
    debugLogger.info("Starting open page test");
    debugLogger.keyValue("Page ID", pageId);

    const pageStore = usePageStore.getState();
    const page = pageStore.getPage(pageId);

    if (page) {
      debugLogger.info("Page found in store");
      debugLogger.keyValue("Title", page.title);
      debugLogger.keyValue("Path", page.filePath);
    } else {
      debugLogger.warn("Page not found in store (may be loaded from backend)");
    }

    await executeOpenPage(pageId);

    debugLogger.success("Page opened successfully");

    // Verify page was opened
    const currentPageId = usePageStore.getState().currentPageId;
    debugLogger.keyValue("Current Page ID", currentPageId);

    if (currentPageId === pageId) {
      debugLogger.success("✓ Verification passed: Page is now current");
    } else {
      debugLogger.error(
        `✗ Verification failed: Expected ${pageId}, got ${currentPageId}`
      );
    }
  } catch (error) {
    debugLogger.error("Open page test failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Test the complete search and open workflow
 * @param query - Search query
 */
export async function debugSearchAndOpen(query: string): Promise<void> {
  const debugLogger = createDebugLogger("debugSearchAndOpen");
  debugLogger.section("Testing Complete Search and Open Workflow");

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    debugLogger.error("No workspace selected");
    return;
  }

  try {
    // Step 1: Search
    debugLogger.group("STEP 1: Search");
    debugLogger.info("Searching for:", query);

    const results = await executeSearchNotes(workspacePath, query);

    debugLogger.success(`Found ${results.length} results`);

    if (results.length === 0) {
      debugLogger.warn("No results found, cannot open");
      debugLogger.groupEnd();
      return;
    }

    const topResult = results[0];
    debugLogger.keyValue("Top result", topResult.pageTitle);
    debugLogger.keyValue("Score", topResult.rank);
    debugLogger.keyValue("Page ID", topResult.pageId);
    debugLogger.groupEnd();

    // Step 2: Open
    debugLogger.group("STEP 2: Open Page");
    debugLogger.info("Opening page:", topResult.pageTitle);

    await executeOpenPage(topResult.pageId);

    debugLogger.success("Page opened successfully");

    const currentPageId = usePageStore.getState().currentPageId;
    if (currentPageId === topResult.pageId) {
      debugLogger.success("✓ Verification passed");
    } else {
      debugLogger.warn("✗ Verification failed");
    }
    debugLogger.groupEnd();

    debugLogger.section("Workflow Complete");
    debugLogger.success("Search and open workflow executed successfully!");
  } catch (error) {
    debugLogger.error("Workflow test failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Test tool validation
 */
export function debugValidateTools(): void {
  const debugLogger = createDebugLogger("debugValidateTools");
  debugLogger.section("Testing Tool Validation");

  try {
    // Test 1: Valid search_notes input
    debugLogger.group("Test 1: Valid search_notes input");
    const searchInputValid = ToolExecutor.validateToolInput("search_notes", {
      query: "test",
    });
    debugLogger.keyValue("Result", searchInputValid ? "✓ PASS" : "✗ FAIL");
    debugLogger.groupEnd();

    // Test 2: Invalid search_notes input (missing query)
    debugLogger.group("Test 2: Invalid search_notes input");
    const searchInputInvalid = ToolExecutor.validateToolInput(
      "search_notes",
      {}
    );
    debugLogger.keyValue("Result", !searchInputInvalid ? "✓ PASS" : "✗ FAIL");
    debugLogger.groupEnd();

    // Test 3: Valid open_page input
    debugLogger.group("Test 3: Valid open_page input");
    const openInputValid = ToolExecutor.validateToolInput("open_page", {
      pageId: "test-id",
    });
    debugLogger.keyValue("Result", openInputValid ? "✓ PASS" : "✗ FAIL");
    debugLogger.groupEnd();

    // Test 4: Invalid open_page input (missing pageId)
    debugLogger.group("Test 4: Invalid open_page input");
    const openInputInvalid = ToolExecutor.validateToolInput("open_page", {});
    debugLogger.keyValue("Result", !openInputInvalid ? "✓ PASS" : "✗ FAIL");
    debugLogger.groupEnd();

    debugLogger.section("Validation Tests Complete");
  } catch (error) {
    debugLogger.error("Validation test failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Test tool inspection
 */
export function debugInspectTools(): void {
  const debugLogger = createDebugLogger("debugInspectTools");
  debugLogger.section("Inspecting Available Tools");

  try {
    const tools = ToolExecutor.getToolsForAPI();

    debugLogger.info(`Found ${tools.length} tools`);
    debugLogger.table(
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        schema: `${
          t.input_schema.properties
            ? Object.keys(t.input_schema.properties).join(", ")
            : "N/A"
        }`,
      }))
    );

    for (const tool of tools) {
      debugLogger.group(`Tool: ${tool.name}`);
      debugLogger.keyValue("Description", tool.description);
      debugLogger.keyValue("Input Type", tool.input_schema.type);
      debugLogger.keyValue(
        "Required Fields",
        tool.input_schema.required?.join(", ") || "None"
      );
      if (tool.input_schema.properties) {
        debugLogger.log("Properties:");
        for (const [key, value] of Object.entries(
          tool.input_schema.properties
        )) {
          const prop = value as Record<string, unknown>;
          debugLogger.keyValue(`  ${key}`, `${prop.type || "unknown"}`);
        }
      }
      debugLogger.groupEnd();
    }

    debugLogger.section("Tool Inspection Complete");
  } catch (error) {
    debugLogger.error("Tool inspection failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Simulate AI response processing
 * @param toolName - Tool name to simulate
 * @param toolInput - Tool input to use
 */
export async function debugSimulateAIResponse(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<void> {
  const debugLogger = createDebugLogger("debugSimulateAIResponse");
  debugLogger.section("Simulating AI Response Processing");

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    debugLogger.error("No workspace selected");
    return;
  }

  try {
    debugLogger.info("Simulating AI response with tool use");
    debugLogger.keyValue("Tool", toolName);
    debugLogger.keyValue("Input", JSON.stringify(toolInput));

    // Simulate Claude API response
    const simulatedResponse = {
      content: [
        {
          type: "text",
          text: `I'll help you with the ${toolName} tool.`,
        },
        {
          type: "tool_use",
          name: toolName,
          input: toolInput,
        },
      ],
    };

    debugLogger.group("Processing simulated response");
    const results = await processAIResponse(simulatedResponse, workspacePath);

    debugLogger.success(`Processing complete. Results: ${results.length}`);

    results.forEach((result, idx) => {
      debugLogger.group(`Result ${idx + 1}`);
      debugLogger.keyValue("Type", result.type);
      debugLogger.keyValue("Tool", result.toolName || "N/A");
      debugLogger.keyValue(
        "Content",
        result.content.substring(0, 100) +
          (result.content.length > 100 ? "..." : "")
      );
      debugLogger.groupEnd();
    });

    debugLogger.groupEnd();
    debugLogger.section("Simulation Complete");
  } catch (error) {
    debugLogger.error("AI response simulation failed");
    debugLogger.error("Error:", error);
  }
}

/**
 * Print system information and current state
 */
export function debugPrintSystemInfo(): void {
  const debugLogger = createDebugLogger("debugPrintSystemInfo");
  debugLogger.section("System Information");

  try {
    // Workspace info
    debugLogger.group("Workspace");
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    debugLogger.keyValue("Path", workspacePath || "None selected");
    debugLogger.groupEnd();

    // Page store info
    debugLogger.group("Page Store");
    const pageStore = usePageStore.getState();
    debugLogger.keyValue("Current Page ID", pageStore.currentPageId || "None");
    debugLogger.keyValue("Total Pages", pageStore.pageIds.length);
    debugLogger.keyValue("Loading", pageStore.isLoading);
    if (pageStore.currentPageId) {
      const currentPage = pageStore.getPage(pageStore.currentPageId);
      if (currentPage) {
        debugLogger.keyValue("Current Page Title", currentPage.title);
      }
    }
    debugLogger.groupEnd();

    // Tools info
    debugLogger.group("Available Tools");
    const tools = ToolExecutor.getToolsForAPI();
    debugLogger.keyValue("Count", tools.length);
    debugLogger.keyValue("Names", tools.map((t) => t.name).join(", "));
    debugLogger.groupEnd();

    // Browser info
    debugLogger.group("Environment");
    debugLogger.keyValue("Node Env", import.meta.env.NODE_ENV);
    debugLogger.keyValue("Dev", import.meta.env.DEV);
    debugLogger.keyValue("Prod", import.meta.env.PROD);
    debugLogger.groupEnd();

    debugLogger.section("System Information Complete");
  } catch (error) {
    debugLogger.error("Failed to print system info");
    debugLogger.error("Error:", error);
  }
}

/**
 * Interactive debugging interface
 */
export function debugInteractive(): void {
  console.clear();
  console.log(
    "%c╔═══════════════════════════════════════╗",
    "color: cyan; font-weight: bold"
  );
  console.log(
    "%c║   Copilot Tools Debug Interface      ║",
    "color: cyan; font-weight: bold"
  );
  console.log(
    "%c╚═══════════════════════════════════════╝",
    "color: cyan; font-weight: bold"
  );
  console.log("");
  console.log("%cAvailable Commands:", "color: green; font-weight: bold");
  console.log(
    "  debugSearch(query)                  - Test search functionality"
  );
  console.log(
    "  debugOpen(pageId)                   - Test open page functionality"
  );
  console.log("  debugSearchAndOpen(query)           - Test complete workflow");
  console.log("  debugValidateTools()                - Test tool validation");
  console.log(
    "  debugInspectTools()                 - Inspect available tools"
  );
  console.log("  debugSimulateAIResponse(tool, input) - Simulate AI response");
  console.log(
    "  debugPrintSystemInfo()              - Print system information"
  );
  console.log("  debugInteractive()                  - Show this help message");
  console.log("");
  console.log("%cExamples:", "color: green; font-weight: bold");
  console.log("  await debugSearch('project planning');");
  console.log("  await debugOpen('page-id-123');");
  console.log("  await debugSearchAndOpen('budget review');");
  console.log(
    "  await debugSimulateAIResponse('search_notes', { query: 'test' });"
  );
  console.log("");
}

/**
 * Debug logger utility for consistent formatting
 */
function createDebugLogger(moduleName: string) {
  const prefix = `%c[${moduleName}]`;
  const prefixStyle = "color: #FF6B9D; font-weight: bold";

  return {
    section: (title: string) => {
      console.log("");
      console.log(`%c${"═".repeat(50)}`, "color: #4A90E2; font-weight: bold");
      console.log(`${prefix} ${title}`, prefixStyle);
      console.log(`%c${"═".repeat(50)}`, "color: #4A90E2; font-weight: bold");
    },

    group: (label: string) => {
      console.group(`${prefix} ${label}`, prefixStyle);
    },

    groupEnd: () => {
      console.groupEnd();
    },

    info: (...args: unknown[]) => {
      console.info(`${prefix} ℹ`, prefixStyle, ...args);
    },

    success: (...args: unknown[]) => {
      console.log(`${prefix} ✓`, prefixStyle, ...args);
    },

    warn: (...args: unknown[]) => {
      console.warn(`${prefix} ⚠`, prefixStyle, ...args);
    },

    error: (...args: unknown[]) => {
      console.error(`${prefix} ✗`, prefixStyle, ...args);
    },

    log: (...args: unknown[]) => {
      console.log(prefix, prefixStyle, ...args);
    },

    keyValue: (key: string, value: unknown) => {
      console.log(
        `${prefix} %c${key}:%c ${value}`,
        prefixStyle,
        "color: #7ED321; font-weight: bold",
        "color: white"
      );
    },

    table: (data: unknown) => {
      console.table(data);
    },
  };
}

/**
 * Export debug interface to window for easy access in console
 * Usage: window.__copilotDebug.search("query")
 */
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__copilotDebug = {
    search: debugSearch,
    open: debugOpen,
    searchAndOpen: debugSearchAndOpen,
    validateTools: debugValidateTools,
    inspectTools: debugInspectTools,
    simulateAIResponse: debugSimulateAIResponse,
    systemInfo: debugPrintSystemInfo,
    help: debugInteractive,
  };

  console.log(
    "%c📋 Copilot Debug Tools Ready! Type: window.__copilotDebug.help()",
    "color: #FF6B9D; font-weight: bold; font-size: 12px"
  );
}
