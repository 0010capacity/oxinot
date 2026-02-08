import { blockTools } from "./block";
import { contextTools } from "./context";
import { pingTool } from "./examples/pingTool";
import { filesystemTools } from "./filesystem";
import { navigationTools } from "./navigation";
import { pageTools } from "./page";
import { toolRegistry } from "./registry";

/**
 * Initialize the tool registry with all available tools
 * This should be called once during app startup
 */
export function initializeToolRegistry(): void {
  // Avoid re-initialization
  if (toolRegistry.getAll().length > 0) {
    console.log("[ToolRegistry] Already initialized, skipping...");
    return;
  }

  console.log("[ToolRegistry] Initializing tool registry...");

  try {
    // Register all tools
    toolRegistry.registerMany([
      ...pageTools,
      ...blockTools,
      ...filesystemTools,
      ...contextTools,
      ...navigationTools,
      pingTool,
    ]);

    const allTools = toolRegistry.getAll();
    console.log(
      `[ToolRegistry] ✓ Successfully initialized with ${allTools.length} tools:`,
      allTools.map((t) => t.name),
    );
  } catch (error) {
    console.error(
      "[ToolRegistry] ✗ Failed to initialize:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}
