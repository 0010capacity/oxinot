import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { type FileSystemItem, tauriAPI } from "../tauri-api";

interface WorkspaceContextType {
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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileTree, setFileTree] = useState<FileSystemItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await tauriAPI.readDirectory(path);
      setFileTree(items);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
      console.error("Error loading directory:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectWorkspace = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const path = await tauriAPI.selectWorkspace();

      if (path) {
        setWorkspacePath(path);
        setCurrentPath(path);
        const items = await tauriAPI.readDirectory(path);
        setFileTree(items);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to select workspace",
      );
      console.error("Error selecting workspace:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openFile = useCallback(async (filePath: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const content = await tauriAPI.readFile(filePath);
      setFileContent(content);
      setCurrentFile(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
      console.error("Error opening file:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFile = useCallback(async (filePath: string, content: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await tauriAPI.writeFile(filePath, content);
      setFileContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
      console.error("Error saving file:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewFile = useCallback(
    async (dirPath: string, fileName: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await tauriAPI.createFile(dirPath, fileName);
        await loadDirectory(currentPath || dirPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create file");
        console.error("Error creating file:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentPath, loadDirectory],
  );

  const createNewDirectory = useCallback(
    async (parentPath: string, dirName: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await tauriAPI.createDirectory(parentPath, dirName);
        await loadDirectory(currentPath || parentPath);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create directory",
        );
        console.error("Error creating directory:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentPath, loadDirectory],
  );

  const deleteItem = useCallback(
    async (path: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await tauriAPI.deletePath(path);

        if (currentFile === path) {
          setCurrentFile(null);
          setFileContent("");
        }

        await loadDirectory(currentPath || workspacePath!);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete item");
        console.error("Error deleting item:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentPath, currentFile, workspacePath, loadDirectory],
  );

  const renameItem = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const newPath = await tauriAPI.renamePath(oldPath, newName);

        if (currentFile === oldPath) {
          setCurrentFile(newPath);
        }

        await loadDirectory(currentPath || workspacePath!);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename item");
        console.error("Error renaming item:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentPath, currentFile, workspacePath, loadDirectory],
  );

  const value: WorkspaceContextType = {
    workspacePath,
    currentPath,
    currentFile,
    fileContent,
    fileTree,
    isLoading,
    error,
    selectWorkspace,
    loadDirectory,
    openFile,
    saveFile,
    createNewFile,
    createNewDirectory,
    deleteItem,
    renameItem,
    setFileContent,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
