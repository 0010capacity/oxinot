import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { type FileSystemItem, tauriAPI } from "../tauri-api";
import { useBlockStore } from "./blockStore";
import { usePageStore } from "./pageStore";

// Throttle lastAccessed updates to 5 minutes
const LAST_ACCESSED_THROTTLE_MS = 5 * 60 * 1000;

function shouldUpdateLastAccessed(lastAccessed: number): boolean {
  return Date.now() - lastAccessed > LAST_ACCESSED_THROTTLE_MS;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  lastAccessed: number;
}

interface WorkspaceState {
  workspacePath: string | null;
  currentPath: string | null;
  currentFile: string | null;
  fileContent: string;
  fileTree: FileSystemItem[];
  isLoading: boolean;
  error: string | null;
  workspaces: WorkspaceInfo[];

  // Actions
  selectWorkspace: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  addWorkspace: (path: string, name?: string) => void;
  removeWorkspace: (path: string) => void;
  getWorkspaces: () => WorkspaceInfo[];
  loadDirectory: (path: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  createNewFile: (dirPath: string, fileName: string) => Promise<void>;
  createNewDirectory: (parentPath: string, dirName: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  setFileContent: (content: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useWorkspaceStore = createWithEqualityFn<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspacePath: null,
      currentPath: null,
      currentFile: null,
      fileContent: "",
      fileTree: [],
      isLoading: false,
      error: null,
      workspaces: [],

      selectWorkspace: async () => {
        try {
          set({ isLoading: true, error: null });
          const path = await tauriAPI.selectWorkspace();

          if (path) {
            // Clear page and block stores when switching workspaces
            usePageStore.getState().clearPages();
            useBlockStore.getState().clearPage();

            const items = await tauriAPI.readDirectory(path);
            const name = path.split("/").pop() || path;

            // Add to workspace list
            get().addWorkspace(path, name);

            set({
              workspacePath: path,
              currentPath: path,
              fileTree: items,
            });
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to select workspace";
          set({ error: errorMessage });
          console.error("Error selecting workspace:", err);
        } finally {
          set({ isLoading: false });
        }
      },

      openWorkspace: async (path: string) => {
        try {
          set({ isLoading: true, error: null });

          // Clear page and block stores when switching workspaces
          usePageStore.getState().clearPages();
          useBlockStore.getState().clearPage();

          const items = await tauriAPI.readDirectory(path);

          // Update last accessed time (throttled to 5 minutes)
          const workspaces = get().workspaces.map((w) => {
            if (w.path === path && shouldUpdateLastAccessed(w.lastAccessed)) {
              return { ...w, lastAccessed: Date.now() };
            }
            return w;
          });

          set({
            workspacePath: path,
            currentPath: path,
            fileTree: items,
            workspaces,
          });

          // Load pages after opening workspace
          await usePageStore.getState().loadPages();
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to open workspace";
          set({ error: errorMessage });
          console.error("Error opening workspace:", err);
        } finally {
          set({ isLoading: false });
        }
      },

      addWorkspace: (path: string, name?: string) => {
        const workspaces = get().workspaces;
        const exists = workspaces.find((w) => w.path === path);

        if (!exists) {
          const workspaceName = name || path.split("/").pop() || path;
          set({
            workspaces: [
              ...workspaces,
              {
                name: workspaceName,
                path,
                lastAccessed: Date.now(),
              },
            ],
          });
        } else {
          // Update last accessed time (throttled to 5 minutes)
          if (shouldUpdateLastAccessed(exists.lastAccessed)) {
            set({
              workspaces: workspaces.map((w) =>
                w.path === path ? { ...w, lastAccessed: Date.now() } : w,
              ),
            });
          }
        }
      },

      removeWorkspace: (path: string) => {
        const { workspacePath } = get();
        const isActiveWorkspace = workspacePath === path;

        set({
          workspaces: get().workspaces.filter((w) => w.path !== path),
          // Reset workspace path if removing the active workspace
          ...(isActiveWorkspace && {
            workspacePath: null,
            currentPath: null,
            currentFile: null,
            fileContent: "",
            fileTree: [],
            isLoading: false,
            error: null,
          }),
        });
      },

      getWorkspaces: () => {
        return get().workspaces.sort((a, b) => b.lastAccessed - a.lastAccessed);
      },

      loadDirectory: async (path: string) => {
        try {
          set({ isLoading: true, error: null });
          const items = await tauriAPI.readDirectory(path);
          set({ fileTree: items, currentPath: path });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to load directory";
          set({ error: errorMessage });
          console.error("Error loading directory:", err);
        } finally {
          set({ isLoading: false });
        }
      },

      openFile: async (filePath: string) => {
        try {
          set({ isLoading: true, error: null });
          const content = await tauriAPI.readFile(filePath);
          set({ fileContent: content, currentFile: filePath });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to open file";
          set({ error: errorMessage });
          console.error("Error opening file:", err);
        } finally {
          set({ isLoading: false });
        }
      },

      saveFile: async (filePath: string, content: string) => {
        try {
          set({ isLoading: true, error: null });
          await tauriAPI.writeFile(filePath, content);
          set({ fileContent: content });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to save file";
          set({ error: errorMessage });
          console.error("Error saving file:", err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      createNewFile: async (dirPath: string, fileName: string) => {
        try {
          set({ isLoading: true, error: null });
          await tauriAPI.createFile(dirPath, fileName);
          const { currentPath } = get();
          await get().loadDirectory(currentPath || dirPath);
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to create file";
          set({ error: errorMessage });
          console.error("Error creating file:", err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      createNewDirectory: async (parentPath: string, dirName: string) => {
        try {
          set({ isLoading: true, error: null });
          await tauriAPI.createDirectory(parentPath, dirName);
          const { currentPath } = get();
          await get().loadDirectory(currentPath || parentPath);
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to create directory";
          set({ error: errorMessage });
          console.error("Error creating directory:", err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      deleteItem: async (path: string) => {
        try {
          set({ isLoading: true, error: null });
          const { workspacePath } = get();

          // Use deletePathWithDb if we have workspace context to ensure database is cleaned up
          if (workspacePath) {
            await tauriAPI.deletePathWithDb(workspacePath, path);
          } else {
            await tauriAPI.deletePath(path);
          }

          const { currentFile, currentPath } = get();
          if (currentFile === path) {
            set({ currentFile: null, fileContent: "" });
          }

          if (currentPath || workspacePath) {
            await get().loadDirectory(currentPath || (workspacePath as string));
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to delete item";
          set({ error: errorMessage });
          console.error("Error deleting item:", err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      renameItem: async (oldPath: string, newName: string) => {
        try {
          set({ isLoading: true, error: null });

          const { workspacePath } = get();
          if (!workspacePath) throw new Error("No workspace selected");

          const newPath = await tauriAPI.renamePath(oldPath, newName);

          const { currentFile, currentPath } = get();
          const isRenamingCurrentFile = currentFile === oldPath;

          // Delegate wiki link rewriting to backend for consistency and transactional safety.
          // This prevents race conditions and performance issues from frontend file traversal.
          try {
            await tauriAPI.rewriteWikiLinksForPagePathChange(
              workspacePath,
              oldPath,
              newPath,
            );
          } catch (e) {
            console.warn("[renameItem] Failed to rewrite wiki links:", e);
            // Don't fail the entire rename operation if link rewriting fails
          }

          // Keep app state in sync with the renamed file path/content
          if (isRenamingCurrentFile) {
            const content = await tauriAPI.readFile(newPath);
            set({ currentFile: newPath, fileContent: content });
          } else if (currentFile) {
            // Reload current file if it may contain references to the renamed file
            // (backend may have updated it)
            try {
              const content = await tauriAPI.readFile(currentFile);
              set({ fileContent: content });
            } catch (e) {
              console.warn("[renameItem] Failed to reload current file:", e);
            }
          }

          if (currentPath) {
            await get().loadDirectory(currentPath);
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to rename item";
          set({ error: errorMessage });
          console.error("Error renaming item:", err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      setFileContent: (content: string) => {
        set({ fileContent: content });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "workspace-store",
      partialize: (state) => ({
        workspaces: state.workspaces,
        workspacePath: state.workspacePath,
      }),
    },
  ),
);
