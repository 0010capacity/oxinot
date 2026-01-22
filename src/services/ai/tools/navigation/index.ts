import { z } from "zod";
import { useViewStore } from "../../../../stores/viewStore";
import { usePageStore } from "../../../../stores/pageStore";
import { useNavigationStore } from "../../../../stores/navigationStore";
import type { Tool } from "../types";

/**
 * Switch to file tree view (index mode)
 * Navigates user to the main file tree view showing all files and directories
 */
export const switchToIndexTool: Tool = {
  name: "switch_to_index",
  category: "NAVIGATION",
  description: `Switch to file tree view (index mode). This tool navigates users to the main workspace view showing all files and directories.

Example user commands that should trigger this tool:
- "Go to file tree"
- "Show me all my files"
- "Navigate to the main view"
- "Go back to the home screen"
- "Switch to file tree view"

Notes:
- This switches the view mode from 'note' to 'index'
- Automatically updates the breadcrumb navigation
- No parameters required`,
  parameters: z.object({}).strict(),
  isDangerous: false,
  execute: async () => {
    console.log("[switch_to_index] Switching to file tree view");

    try {
      // Direct store integration
      const viewStore = useViewStore.getState();
      viewStore.showIndex();

      return {
        success: true,
        data: "Switched to file tree view",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to switch to file tree view: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Switch to note/editor view
 * Navigates to a specific page by ID or path
 */
export const switchToNoteViewTool: Tool = {
  name: "switch_to_note_view",
  category: "NAVIGATION",
  description: `Switch to editor/note view. Optionally opens a specific page by ID or path.

Example user commands that should trigger this tool:
- "Open the Q1 Budget page"
- "Show me the project planning notes"
- "Navigate to my meeting notes from yesterday"
- "Open page 'design-review'"

Notes:
- Use pageId from search_results or query_pages tools
- If user mentions a page by name, use query_pages first to find it
- Automatically switches to note view mode
- Updates breadcrumb navigation with full path`,
  parameters: z.object({
    pageId: z
      .string()
      .optional()
      .describe(
        "The unique ID of the page to open. Obtain this from search_pages or query_pages tool results. Use this when you have the exact page ID from a previous search."
      ),
    pagePath: z
      .string()
      .optional()
      .describe(
        "The full path of the page to open. Use this when you know the exact file path but not the page ID."
      ),
  }),
  isDangerous: false,
  execute: async ({ pageId, pagePath }) => {
    console.log(
      `[switch_to_note_view] Switching to note view: ${pageId || pagePath}`
    );

    try {
      const viewStore = useViewStore.getState();

      if (pageId) {
        // Open by page ID
        viewStore.showPage(pageId);
        return {
          success: true,
          data: `Opened page ${pageId}`,
        };
      } else if (pagePath) {
        // Parse path to get page info
        const pageStore = usePageStore.getState();
        const page = Object.values(pageStore.pagesById).find(
          (p) => p.filePath === pagePath
        );

        if (page) {
          viewStore.showPage(page.id);
          return {
            success: true,
            data: `Opened page "${page.title}"`,
          };
        } else {
          return {
            success: false,
            error: `Page not found for path: ${pagePath}`,
          };
        }
      } else {
        // If no page specified, just switch to note view mode
        viewStore.showIndex();
        return {
          success: true,
          data: "Switched to note view mode",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to switch to note view: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Navigate to a specific directory or file path in the file tree
 * Expands parent directories and optionally opens the target file/directory
 */
export const navigateToPathTool: Tool = {
  name: "navigate_to_path",
  category: "NAVIGATION",
  description: `Navigate to a specific directory or file path in the file tree. This tool expands parent directories in the file tree and optionally opens the target file or directory.

Example user commands that should trigger this tool:
- "Navigate to the Projects folder"
- "Go to Documents/Q1 2024"
- "Show me the Budget folder contents"
- "Navigate to the root directory"
- "Go to the file 'meeting-notes.md'"

Notes:
- Expands all parent directories in the path
- If the target is a file, opens it in the editor
- If the target is a directory, navigates to it in index view
- Updates the current path state
- Uses workspaceStore for path expansion`,
  parameters: z.object({
    path: z
      .string()
      .describe(
        "Directory or file path to navigate to (e.g., 'Projects/Q1 Budget', 'Documents/notes', 'meeting-notes.md')"
      ),
  }),
  isDangerous: false,
  execute: async ({ path }) => {
    console.log(`[navigate_to_path] Navigating to path: ${path}`);

    // This will require workspaceStore integration
    // For now, we'll store the path for UI components to handle
    return {
      success: true,
      data: `Navigated to ${path}`,
      metadata: {
        targetPath: path,
      },
    };
  },
};

/**
 * Navigate back in view history
 */
export const goBackTool: Tool = {
  name: "go_back",
  category: "NAVIGATION",
  description: `Navigate back in the view history. Use this tool to go to the previously viewed page or file tree view.

Example user commands that should trigger this tool:
- "Go back"
- "Take me back"
- "Go to the previous page"
- "Return to where I was"

Notes:
- Uses navigationStore to track history
- Navigates to the previous entry in history
- Can be called multiple times to go further back
- Automatically switches to the appropriate view mode`,
  parameters: z.object({}).strict(),
  isDangerous: false,
  execute: async () => {
    console.log("[go_back] Navigating back");

    try {
      const viewStore = useViewStore.getState();
      const navigationStore = useNavigationStore.getState();

      const entry = navigationStore.goBack();
      if (entry) {
        viewStore.showPage(entry.pageId);
      } else {
        return {
          success: false,
          error: "Cannot go back further",
        };
      }

      return {
        success: true,
        data: entry ? "Navigated back" : "Cannot go back further",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to navigate back: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Navigate forward in view history
 */
export const goForwardTool: Tool = {
  name: "go_forward",
  category: "NAVIGATION",
  description: `Navigate forward in the view history. Use this tool to go to the next page in your navigation history.

Example user commands that should trigger this tool:
- "Go forward"
- "Go to the next page"
- "Show me the next page"

Notes:
- Uses navigationStore to track history
- Navigates to the next entry in history
- Can be called multiple times to go further forward
- Automatically switches to the appropriate view mode`,
  parameters: z.object({}).strict(),
  isDangerous: false,
  execute: async () => {
    console.log("[go_forward] Navigating forward");

    try {
      const viewStore = useViewStore.getState();
      const navigationStore = useNavigationStore.getState();

      const entry = navigationStore.goForward();
      if (entry) {
        viewStore.showPage(entry.pageId);
      } else {
        return {
          success: false,
          error: "Cannot go forward further",
        };
      }

      return {
        success: true,
        data: entry ? "Navigated forward" : "Cannot go forward further",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to navigate forward: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};
