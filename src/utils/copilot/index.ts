/**
 * Copilot Utilities Index
 * Exports all copilot-related tools, registry, and executors
 */

// Tool definitions
export {
  searchNotesTool,
  openPageTool,
  executeSearchNotes,
  executeOpenPage,
  processPageToolCall,
  getPageTools,
} from "./pageTools";

// Tool registry
export {
  ToolRegistry,
  toolRegistry,
  type ToolDefinition,
} from "./toolRegistry";

// Tool executor
export { ToolExecutor, processAIResponse } from "./toolExecutor";

// Debug utilities
export {
  debugSearch,
  debugOpen,
  debugSearchAndOpen,
  debugValidateTools,
  debugInspectTools,
  debugSimulateAIResponse,
  debugPrintSystemInfo,
  debugInteractive,
} from "./debug";
