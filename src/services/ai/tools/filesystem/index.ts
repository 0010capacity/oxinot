import { z } from "zod";
import { tauriAPI } from "../../../tauri-api";
import type { Tool, ToolContext, ToolResult } from "../types";
import { uiEventEmitter } from "./uiEvents";

/**
 * Create a new file or directory in the workspace
 * Can create markdown files (.md extension) or directories
 */
export const createFileTool: Tool = {
  name: "create_file",
  category: "FILESYSTEM",
  description: `Create a new file or directory in the workspace. Can create markdown files (.md extension) or directories.

Example user commands that should trigger this tool:
- "Create a new file called 'Project Notes'"
- "Make a new file 'meeting-notes.md'"
- "Create a directory called 'Projects'"
- "Create a new markdown file 'todo.md'"
- "Add a file 'readme.md' with some content"

Notes:
- If path doesn't end in .md, it will be appended automatically
- Empty files can be created without content
- Use this tool to create both individual files and organize directories`,
  parameters: z.object({
    path: z
      .string()
      .describe(
        "Full path where to create the file (e.g., 'Projects/new-notes.md', 'Documents/notes')",
      ),
    type: z
      .enum(["file", "directory"])
      .optional()
      .describe(
        "Type to create: 'file' or 'directory'. Defaults to 'file' if not specified.",
      ),
    content: z
      .string()
      .optional()
      .describe(
        "Content to write to the file (only for file type, not directory)",
      ),
  }),
  isDangerous: false,
  requiresApproval: false,
  execute: async ({ path, type = "file", content }, context) => {
    console.log(`[create_file] Creating ${type} at path: ${path}`);

    try {
      let result;

      if (type === "directory") {
        result = await tauriAPI.createDirectory(path);
      } else {
        // Default to .md if not specified
        const filePath = path.endsWith(".md") || !content ? path : `${path}.md`;

        if (content) {
          result = await tauriAPI.writeFile(filePath, content);
        } else {
          result = await tauriAPI.createFile(filePath);
        }
      }

      if (result.success) {
        // Emit file creation event
        uiEventEmitter.emit({
          type: "file_created",
          timestamp: new Date(),
          payload: { path, type, content },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to create file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Delete a file or directory from the workspace
 * This operation cannot be undone
 */
export const deleteFileTool: Tool = {
  name: "delete_file",
  category: "FILESYSTEM",
  description: `Delete a file or directory from the workspace. This operation cannot be undone.

Example user commands that should trigger this tool:
- "Delete the project-planning.md file"
- "Remove this meeting notes file"
- "Delete the folder 'Old Projects'"
- "Trash the file 'temp.md'"

Notes:
- Requires user confirmation (unless confirm=false is explicitly passed)
- Emits file_deleted event for UI to refresh
- If deleted file was currently open, user is redirected to file tree view`,
  parameters: z.object({
    path: z.string().describe("Path of the file or directory to delete"),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Whether to show confirmation dialog. Defaults to true if not specified.",
      ),
  }),
  isDangerous: true,
  requiresApproval: true,
  execute: async ({ path, confirm = true }, context) => {
    console.log(`[delete_file] Deleting path: ${path}`);

    // Show confirmation if requested
    if (confirm && !confirm(`Are you sure you want to delete ${path}?`)) {
      return {
        success: false,
        error: "Delete cancelled by user",
      };
    }

    try {
      const result = await tauriAPI.deleteFile(path);

      if (result.success) {
        // Emit file deletion event
        uiEventEmitter.emit({
          type: "file_deleted",
          timestamp: new Date(),
          payload: { path },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Rename a file or directory in the workspace
 * Useful for correcting typos or organizing files
 */
export const renameFileTool: Tool = {
  name: "rename_file",
  category: "FILESYSTEM",
  description: `Rename a file or directory in the workspace.

Example user commands that should trigger this tool:
- "Rename 'notes.md' to 'ideas.md'"
- "Change 'meeting-notes' to 'Weekly Meeting Notes'"
- "Rename the folder 'temp' to 'archive'"
- "Rename 'drafts.md' to 'final-version.md'"

Notes:
- Constructs new path by replacing the last component with newName
- Emits file_renamed event for UI to refresh
- Automatically appends .md extension if missing for files`,
  parameters: z.object({
    oldPath: z
      .string()
      .describe("Current path of the file/directory to rename"),
    newName: z
      .string()
      .describe("New name for the file/directory (without path)"),
  }),
  isDangerous: false,
  requiresApproval: true,
  execute: async ({ oldPath, newName }, context) => {
    console.log(`[rename_file] Renaming ${oldPath} to ${newName}`);

    try {
      // Construct new path
      const pathParts = oldPath.split("/");
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join("/");

      const result = await tauriAPI.renameFile(oldPath, newPath);

      if (result.success) {
        // Emit file renamed event
        uiEventEmitter.emit({
          type: "file_renamed",
          timestamp: new Date(),
          payload: { oldPath, newName, newPath },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to rename file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

/**
 * Move a file or directory to a different location in the workspace
 */
export const moveFileTool: Tool = {
  name: "move_file",
  category: "FILESYSTEM",
  description: `Move a file or directory to a different location in the workspace.

Example user commands that should trigger this tool:
- "Move the file 'notes.md' to 'Archived/notes.md'"
- "Move 'meeting-notes.md' to the 'Weekly Meetings' folder"
- "Move 'temp.md' to the root directory"
- "Relocate 'drafts' folder to 'Documents/Archive'"

Notes:
- Moves file/directory and its children
- Emits file_moved event for UI to refresh
- Cannot move files between different workspaces`,
  parameters: z.object({
    sourcePath: z
      .string()
      .describe("Current path of the file/directory to move"),
    destinationPath: z
      .string()
      .describe("Destination path where to move the file/directory"),
  }),
  isDangerous: false,
  requiresApproval: true,
  execute: async ({ sourcePath, destinationPath }, context) => {
    console.log(`[move_file] Moving ${sourcePath} to ${destinationPath}`);

    try {
      const result = await tauriAPI.moveFile(sourcePath, destinationPath);

      if (result.success) {
        // Emit file moved event
        uiEventEmitter.emit({
          type: "file_moved",
          timestamp: new Date(),
          payload: { sourcePath, destinationPath },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to move file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
};

export { createFileTool, deleteFileTool, renameFileTool, moveFileTool };
