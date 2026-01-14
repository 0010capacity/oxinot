import { invoke } from "@tauri-apps/api/core";

export interface FileSystemItem {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
  modified_time: string;
}

export interface PathInfo {
  is_directory: boolean;
  is_file: boolean;
  size: number;
  modified_time: string;
  created_time: string;
}

export const tauriAPI = {
  // Workspace operations
  selectWorkspace: async (): Promise<string | null> => {
    return await invoke<string | null>("select_workspace");
  },

  // File system operations
  readDirectory: async (dirPath: string): Promise<FileSystemItem[]> => {
    return await invoke<FileSystemItem[]>("read_directory", { dirPath });
  },

  readFile: async (filePath: string): Promise<string> => {
    return await invoke<string>("read_file", { filePath });
  },

  writeFile: async (filePath: string, content: string): Promise<boolean> => {
    return await invoke<boolean>("write_file", { filePath, content });
  },

  createFile: async (dirPath: string, fileName: string): Promise<string> => {
    return await invoke<string>("create_file", { dirPath, fileName });
  },

  createDirectory: async (
    parentPath: string,
    dirName: string,
  ): Promise<string> => {
    return await invoke<string>("create_directory", { parentPath, dirName });
  },

  deletePath: async (targetPath: string): Promise<boolean> => {
    return await invoke<boolean>("delete_path", { targetPath });
  },

  deletePathWithDb: async (
    workspacePath: string,
    targetPath: string,
  ): Promise<boolean> => {
    return await invoke<boolean>("delete_path_with_db", {
      workspacePath,
      targetPath,
    });
  },

  renamePath: async (oldPath: string, newName: string): Promise<string> => {
    return await invoke<string>("rename_path", { oldPath, newName });
  },

  movePath: async (
    sourcePath: string,
    targetParentPath: string,
  ): Promise<string> => {
    return await invoke<string>("move_path", { sourcePath, targetParentPath });
  },

  convertFileToDirectory: async (filePath: string): Promise<string> => {
    return await invoke<string>("convert_file_to_directory", { filePath });
  },

  getPathInfo: async (targetPath: string): Promise<PathInfo> => {
    return await invoke<PathInfo>("get_path_info", { targetPath });
  },

  // Workspace sync operations
  syncWorkspaceIncremental: async (
    workspacePath: string,
  ): Promise<{ pages: number; blocks: number }> => {
    return await invoke<{ pages: number; blocks: number }>(
      "sync_workspace_incremental",
      { workspacePath },
    );
  },

  reindexWorkspace: async (
    workspacePath: string,
  ): Promise<{ pages: number; blocks: number }> => {
    return await invoke<{ pages: number; blocks: number }>(
      "reindex_workspace",
      { workspacePath },
    );
  },
};
