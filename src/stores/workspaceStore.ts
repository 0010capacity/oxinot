import { create } from "zustand";
import { tauriAPI, FileSystemItem } from "../tauri-api";

interface WorkspaceState {
  workspacePath: string | null;
  currentPath: string | null;
  currentFile: string | null;
  fileContent: string;
  fileTree: FileSystemItem[];
  isLoading: boolean;
  error: string | null;

  // Actions
  selectWorkspace: () => Promise<void>;
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspacePath: null,
  currentPath: null,
  currentFile: null,
  fileContent: "",
  fileTree: [],
  isLoading: false,
  error: null,

  selectWorkspace: async () => {
    try {
      set({ isLoading: true, error: null });
      const path = await tauriAPI.selectWorkspace();

      if (path) {
        const items = await tauriAPI.readDirectory(path);
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
      await tauriAPI.deletePath(path);

      const { currentFile, currentPath, workspacePath } = get();
      if (currentFile === path) {
        set({ currentFile: null, fileContent: "" });
      }

      await get().loadDirectory(currentPath || workspacePath!);
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
      const newPath = await tauriAPI.renamePath(oldPath, newName);

      const { currentFile, currentPath, workspacePath } = get();
      if (currentFile === oldPath) {
        set({ currentFile: newPath });
      }

      await get().loadDirectory(currentPath || workspacePath!);
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
}));
