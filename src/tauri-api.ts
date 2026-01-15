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

export interface BacklinkBlock {
  block_id: string;
  content: string;
  created_at: string;
}

export interface BacklinkGroup {
  page_id: string;
  page_title: string;
  blocks: BacklinkBlock[];
}

export interface WikiLink {
  id: string;
  from_page_id: string;
  from_block_id: string;
  to_page_id: string | null;
  link_type: string;
  target_path: string;
  raw_target: string;
  alias: string | null;
  heading: string | null;
  block_ref: string | null;
  is_embed: boolean;
}

export const tauriAPI = {
  // Workspace operations
  selectWorkspace: async (): Promise<string | null> => {
    return await invoke<string | null>("select_workspace");
  },

  // Wiki Link Index
  getPageBacklinks: async (
    workspacePath: string,
    pageId: string
  ): Promise<BacklinkGroup[]> => {
    return await invoke<BacklinkGroup[]>("get_page_backlinks", {
      workspacePath,
      pageId,
    });
  },

  getBrokenLinks: async (workspacePath: string): Promise<WikiLink[]> => {
    return await invoke<WikiLink[]>("get_broken_links", { workspacePath });
  },

  reindexWikiLinks: async (workspacePath: string): Promise<void> => {
    return await invoke<void>("reindex_wiki_links", { workspacePath });
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
    dirName: string
  ): Promise<string> => {
    return await invoke<string>("create_directory", { parentPath, dirName });
  },

  deletePath: async (targetPath: string): Promise<boolean> => {
    return await invoke<boolean>("delete_path", { targetPath });
  },

  deletePathWithDb: async (
    workspacePath: string,
    targetPath: string
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
    targetParentPath: string
  ): Promise<string> => {
    return await invoke<string>("move_path", { sourcePath, targetParentPath });
  },

  convertFileToDirectory: async (filePath: string): Promise<string> => {
    return await invoke<string>("convert_file_to_directory", { filePath });
  },

  getPathInfo: async (targetPath: string): Promise<PathInfo> => {
    return await invoke<PathInfo>("get_path_info", { targetPath });
  },

  // Links / references
  rewriteWikiLinksForPagePathChange: async (
    workspacePath: string,
    fromPath: string,
    toPath: string
  ): Promise<number> => {
    return await invoke<number>("rewrite_wiki_links_for_page_path_change", {
      workspacePath,
      fromPath,
      toPath,
    });
  },

  // Workspace sync operations
  syncWorkspaceIncremental: async (
    workspacePath: string
  ): Promise<{ pages: number; blocks: number }> => {
    return await invoke<{ pages: number; blocks: number }>(
      "sync_workspace_incremental",
      { workspacePath }
    );
  },

  reindexWorkspace: async (
    workspacePath: string
  ): Promise<{ pages: number; blocks: number }> => {
    return await invoke<{ pages: number; blocks: number }>(
      "reindex_workspace",
      { workspacePath }
    );
  },
};
