/**
 * Debugging utilities for tool execution and AI integration
 * Provides comprehensive logging and inspection capabilities
 */

import { toolRegistry } from "./registry";
import { useBlockStore } from "../../../stores/blockStore";
import { usePageStore } from "../../../stores/pageStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";

export interface DebugInfo {
  timestamp: string;
  toolsRegistered: string[];
  toolCount: number;
  currentPageId: string | null;
  currentBlockPageId: string | null;
  totalPages: number;
  workspacePath: string | null;
}

export interface ToolExecutionDebug {
  toolName: string;
  timestamp: string;
  params: unknown;
  // biome-ignore lint/suspicious/noExplicitAny: State objects have dynamic structure
  beforeState: any;
  // biome-ignore lint/suspicious/noExplicitAny: State objects have dynamic structure
  afterState: any;
  success: boolean;
  result: unknown;
  duration: number;
}

/**
 * Get comprehensive debug information about the current state
 */
export function getDebugInfo(): DebugInfo {
  const allTools = toolRegistry.getAll();
  const pageStore = usePageStore.getState();
  const blockStore = useBlockStore.getState();
  const workspaceStore = useWorkspaceStore.getState();

  return {
    timestamp: new Date().toISOString(),
    toolsRegistered: allTools.map((t) => t.name),
    toolCount: allTools.length,
    currentPageId: pageStore.currentPageId || null,
    currentBlockPageId: blockStore.currentPageId || null,
    totalPages: Object.keys(pageStore.pagesById).length,
    workspacePath: workspaceStore.workspacePath || null,
  };
}

/**
 * Log tool execution with before/after state comparison
 */
export function logToolExecution(
  toolName: string,
  params: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: State objects have dynamic structure
  beforeState: any,
  // biome-ignore lint/suspicious/noExplicitAny: State objects have dynamic structure
  afterState: any,
  success: boolean,
  result: unknown,
  duration: number,
): ToolExecutionDebug {
  const debug: ToolExecutionDebug = {
    toolName,
    timestamp: new Date().toISOString(),
    params,
    beforeState: {
      pageStoreCurrentPageId: beforeState.pageStore?.currentPageId || null,
      blockStoreCurrentPageId: beforeState.blockStore?.currentPageId || null,
    },
    afterState: {
      pageStoreCurrentPageId: afterState.pageStore?.currentPageId || null,
      blockStoreCurrentPageId: afterState.blockStore?.currentPageId || null,
    },
    success,
    result,
    duration,
  };

  console.group(`[Tool Debug] ${toolName}`);
  console.log("Timestamp:", debug.timestamp);
  console.log("Params:", params);
  console.table({
    "Before Page Store": debug.beforeState.pageStoreCurrentPageId,
    "Before Block Store": debug.beforeState.blockStoreCurrentPageId,
    "After Page Store": debug.afterState.pageStoreCurrentPageId,
    "After Block Store": debug.afterState.blockStoreCurrentPageId,
  });
  console.log("Result:", result);
  console.log(`Duration: ${duration}ms`);
  console.log("Success:", success);
  console.groupEnd();

  return debug;
}

/**
 * Verify tool registry is properly initialized
 */
export function verifyToolRegistry(): {
  isInitialized: boolean;
  toolCount: number;
  tools: string[];
  hasOpenPageTool: boolean;
  hasSearchTools: boolean;
} {
  const allTools = toolRegistry.getAll();
  const toolNames = allTools.map((t) => t.name);

  return {
    isInitialized: allTools.length > 0,
    toolCount: allTools.length,
    tools: toolNames,
    hasOpenPageTool: toolNames.includes("open_page"),
    hasSearchTools: toolNames.some((name) => name.includes("search")),
  };
}

/**
 * Get detailed information about a specific tool
 */
export function getToolInfo(toolName: string) {
  const tool = toolRegistry.get(toolName);

  if (!tool) {
    return {
      found: false,
      message: `Tool '${toolName}' not found in registry`,
    };
  }

  return {
    found: true,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    isDangerous: tool.isDangerous || false,
    requiresApproval: tool.requiresApproval || false,
    // biome-ignore lint/suspicious/noExplicitAny: Zod schema type checking
    parametersSchema: (tool.parameters as any).safeParse
      ? "Zod schema"
      : "Unknown schema type",
  };
}

/**
 * Compare page store and block store state
 */
export function compareStoreStates(): {
  synchronized: boolean;
  pageStoreId: string | null;
  blockStoreId: string | null;
  mismatch: boolean;
  details: string;
} {
  const pageStore = usePageStore.getState();
  const blockStore = useBlockStore.getState();

  const pageStoreId = pageStore.currentPageId || null;
  const blockStoreId = blockStore.currentPageId || null;
  const synchronized = pageStoreId === blockStoreId;

  return {
    synchronized,
    pageStoreId,
    blockStoreId,
    mismatch: !synchronized,
    details: synchronized
      ? `Both stores synchronized on ${pageStoreId}`
      : `Mismatch: pageStore=${pageStoreId}, blockStore=${blockStoreId}`,
  };
}

/**
 * Export debug info to console in a formatted way
 */
export function printDebugReport(): void {
  console.group("[AI Tools Debug Report]");

  console.group("Registry Status");
  const registryStatus = verifyToolRegistry();
  console.table(registryStatus);
  console.groupEnd();

  console.group("Store States");
  const storeComparison = compareStoreStates();
  console.table(storeComparison);
  console.groupEnd();

  console.group("General Info");
  const info = getDebugInfo();
  console.table({
    "Tools Registered": info.toolCount,
    "Total Pages": info.totalPages,
    "Current Page ID": info.currentPageId,
    "Workspace Path": info.workspacePath,
  });
  console.groupEnd();

  console.group("Available Tools");
  const allTools = toolRegistry.getAll();
  console.table(
    allTools.map((t) => ({
      name: t.name,
      category: t.category,
      dangerous: t.isDangerous || false,
    })),
  );
  console.groupEnd();

  console.groupEnd();
}

/**
 * Expose debug utilities to window object for browser console access
 */
export function exposeDebugToWindow(): void {
  if (typeof window === "undefined") return;

  const debugUtils = {
    getDebugInfo,
    verifyToolRegistry,
    getToolInfo,
    compareStoreStates,
    printDebugReport,
    getAllTools: () => toolRegistry.getAll().map((t) => t.name),
    getToolRegistry: () => toolRegistry,
  };

  (window as unknown as Record<string, unknown>).__aiToolsDebug = debugUtils;

  console.log(
    "[AI Tools Debug] Debug utilities exposed to window.__aiToolsDebug",
  );
}
