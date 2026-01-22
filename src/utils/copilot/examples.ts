/**
 * Copilot Tools Usage Examples
 *
 * This file contains practical examples of how to use the copilot tools
 * in various scenarios and integrations.
 */

import { executeSearchNotes, executeOpenPage } from "./pageTools";
import { ToolExecutor, processAIResponse } from "./toolExecutor";
import { useWorkspaceStore } from "../../stores/workspaceStore";

/**
 * Example 1: Simple search and open workflow
 *
 * User says: "Open my project planning notes"
 * AI should:
 * 1. Search for pages matching "project planning"
 * 2. Find the most relevant result
 * 3. Open that page
 */
export async function example1_SearchAndOpen() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  try {
    // Step 1: Search for relevant pages
    console.log("[Example 1] Searching for 'project planning'...");
    const searchResults = await executeSearchNotes(
      workspacePath,
      "project planning"
    );

    if (searchResults.length === 0) {
      console.log("[Example 1] No pages found");
      return;
    }

    // Step 2: Show results to user or select the best one
    console.log(
      `[Example 1] Found ${searchResults.length} results:`,
      searchResults.map((r) => ({
        title: r.pageTitle,
        snippet: r.snippet,
        rank: r.rank,
      }))
    );

    // Step 3: Open the most relevant result (highest rank)
    const topResult = searchResults[0];
    console.log(`[Example 1] Opening page: "${topResult.pageTitle}"`);
    await executeOpenPage(topResult.pageId);

    console.log("[Example 1] Success!");
  } catch (error) {
    console.error("[Example 1] Error:", error);
  }
}

/**
 * Example 2: Multi-language search
 *
 * User says: "내 회의록을 보여줘" (Show me my meeting notes in Korean)
 * The tool should work seamlessly with non-English queries
 */
export async function example2_MultiLanguageSearch() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  try {
    const queries = ["회의록", "会議記録", "réunion", "meeting notes"];

    for (const query of queries) {
      console.log(`[Example 2] Searching in language: "${query}"`);
      const results = await executeSearchNotes(workspacePath, query);
      console.log(`[Example 2] Found ${results.length} results for "${query}"`);
    }
  } catch (error) {
    console.error("[Example 2] Error:", error);
  }
}

/**
 * Example 3: Processing AI response with tool calls
 *
 * This simulates receiving a response from Claude API
 * that includes tool use blocks, then executing those tools
 */
export async function example3_ProcessAIResponse() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  try {
    // Simulated AI response from Claude API
    const aiResponse = {
      content: [
        {
          type: "text",
          text: "I'll search for your project planning notes and open them.",
        },
        {
          type: "tool_use",
          name: "search_notes",
          input: { query: "project planning" },
        },
      ],
    };

    console.log("[Example 3] Processing AI response...");
    const results = await processAIResponse(aiResponse, workspacePath);

    // Results contain both text and tool execution results
    for (const result of results) {
      if (result.type === "text") {
        console.log("[Example 3] AI said:", result.content);
      } else if (result.type === "tool_result") {
        console.log(
          `[Example 3] Tool "${result.toolName}" result:`,
          result.content
        );
      } else if (result.type === "tool_error") {
        console.error(
          `[Example 3] Tool "${result.toolName}" error:`,
          result.content
        );
      }
    }
  } catch (error) {
    console.error("[Example 3] Error:", error);
  }
}

/**
 * Example 4: Direct tool execution
 *
 * Execute tools directly without going through AI response processing
 */
export async function example4_DirectToolExecution() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  try {
    // Execute search_notes directly
    console.log("[Example 4] Executing search_notes tool directly...");
    const searchResult = await ToolExecutor.execute(
      "search_notes",
      { query: "budget review" },
      workspacePath
    );
    console.log("[Example 4] Search result:", searchResult);

    // Extract page ID from result if available
    if (
      searchResult &&
      typeof searchResult === "object" &&
      "results" in searchResult &&
      Array.isArray(searchResult.results) &&
      searchResult.results.length > 0
    ) {
      const pageId = (searchResult.results[0] as { pageId: string }).pageId;

      // Execute open_page directly
      console.log("[Example 4] Executing open_page tool directly...");
      const openResult = await ToolExecutor.execute(
        "open_page",
        { pageId },
        workspacePath
      );
      console.log("[Example 4] Open result:", openResult);
    }
  } catch (error) {
    console.error("[Example 4] Error:", error);
  }
}

/**
 * Example 5: Tool input validation
 *
 * Validate tool inputs before execution
 */
export async function example5_ToolValidation() {
  console.log("[Example 5] Validating tool inputs...");

  // Valid input
  const validInput = { query: "test" };
  const isValid1 = ToolExecutor.validateToolInput("search_notes", validInput);
  console.log(
    `[Example 5] search_notes with ${JSON.stringify(validInput)}: ${isValid1}`
  );

  // Invalid input (missing required field)
  const invalidInput = {};
  const isValid2 = ToolExecutor.validateToolInput("search_notes", invalidInput);
  console.log(`[Example 5] search_notes with empty object: ${isValid2}`);

  // Valid input for open_page
  const validInput2 = { pageId: "page-123" };
  const isValid3 = ToolExecutor.validateToolInput("open_page", validInput2);
  console.log(
    `[Example 5] open_page with ${JSON.stringify(validInput2)}: ${isValid3}`
  );

  // Invalid input (missing required field)
  const invalidInput2 = {};
  const isValid4 = ToolExecutor.validateToolInput("open_page", invalidInput2);
  console.log(`[Example 5] open_page with empty object: ${isValid4}`);
}

/**
 * Example 6: Tool inspection
 *
 * Inspect available tools and their definitions
 */
export function example6_ToolInspection() {
  console.log("[Example 6] Inspecting available tools...");

  // Get all tools for API
  const tools = ToolExecutor.getToolsForAPI();
  console.log("[Example 6] Tools for API:", tools);

  // Get specific tool
  const searchTool = ToolExecutor.getTool("search_notes");
  console.log("[Example 6] search_notes tool definition:", searchTool);

  // Check if tool exists
  const hasSearchNotes = ToolExecutor.getTool("search_notes") !== undefined;
  console.log("[Example 6] Has search_notes tool:", hasSearchNotes);

  const hasUnknownTool = ToolExecutor.getTool("unknown_tool") !== undefined;
  console.log("[Example 6] Has unknown_tool:", hasUnknownTool);
}

/**
 * Example 7: Error handling
 *
 * Properly handle various error scenarios
 */
export async function example7_ErrorHandling() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  // Error 1: Empty search query
  try {
    console.log("[Example 7] Searching with empty query...");
    await executeSearchNotes(workspacePath, "");
  } catch (error) {
    console.error("[Example 7] Error with empty query:", error);
  }

  // Error 2: Invalid page ID
  try {
    console.log("[Example 7] Opening invalid page...");
    await executeOpenPage("invalid-page-id-12345");
  } catch (error) {
    console.error("[Example 7] Error opening page:", error);
  }

  // Error 3: Invalid tool name
  try {
    console.log("[Example 7] Executing unknown tool...");
    await ToolExecutor.execute(
      "unknown_tool",
      { param: "value" },
      workspacePath
    );
  } catch (error) {
    console.error("[Example 7] Error executing unknown tool:", error);
  }

  // Error 4: Missing required parameter
  try {
    console.log("[Example 7] Executing with missing parameter...");
    await ToolExecutor.execute(
      "search_notes",
      {}, // Missing 'query' parameter
      workspacePath
    );
  } catch (error) {
    console.error("[Example 7] Error with missing parameter:", error);
  }
}

/**
 * Example 8: Complete chat workflow
 *
 * Simulates a complete conversation with AI including tool use
 */
export async function example8_CompleteChatWorkflow() {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) {
    console.error("No workspace selected");
    return;
  }

  try {
    console.log("[Example 8] Starting chat workflow...\n");

    // User message
    const userMessage = "Please open my Q1 2024 budget review notes";
    console.log(`[Example 8] User: "${userMessage}"\n`);

    // Step 1: AI processes user message and decides to use tools
    console.log("[Example 8] AI is processing...\n");

    // Step 2: AI calls search_notes tool
    console.log(
      "[Example 8] AI decides to search for: 'Q1 2024 budget review'\n"
    );
    const searchResults = await executeSearchNotes(
      workspacePath,
      "Q1 2024 budget review"
    );

    if (searchResults.length === 0) {
      console.log("[Example 8] No matching pages found");
      console.log(
        "[Example 8] AI: I couldn't find any pages matching 'Q1 2024 budget review'\n"
      );
      return;
    }

    // Step 3: AI selects the best result
    const bestMatch = searchResults[0];
    console.log(
      `[Example 8] Best match: "${bestMatch.pageTitle}" (rank: ${bestMatch.rank})\n`
    );

    // Step 4: AI calls open_page tool
    console.log(`[Example 8] AI is opening page: "${bestMatch.pageTitle}"\n`);
    await executeOpenPage(bestMatch.pageId);

    // Step 5: AI responds to user
    console.log(
      `[Example 8] AI: I found and opened your "${bestMatch.pageTitle}" page.\n`
    );
    console.log(`[Example 8] Snippet preview:\n${bestMatch.snippet}\n`);
  } catch (error) {
    console.error("[Example 8] Error:", error);
  }
}

/**
 * Run all examples
 *
 * Uncomment the examples you want to run
 */
export async function runAllExamples() {
  console.log("========== Copilot Tools Examples ==========\n");

  try {
    // Uncomment to run specific examples
    // await example1_SearchAndOpen();
    // await example2_MultiLanguageSearch();
    // await example3_ProcessAIResponse();
    // await example4_DirectToolExecution();
    // example5_ToolValidation();
    // example6_ToolInspection();
    // await example7_ErrorHandling();
    // await example8_CompleteChatWorkflow();

    console.log("\n========== Examples Complete ==========");
  } catch (error) {
    console.error("Failed to run examples:", error);
  }
}
