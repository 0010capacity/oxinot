import { invoke } from "@tauri-apps/api/core";

// Input validation utilities
const validatePath = (path: string, paramName: string): void => {
  if (!path || typeof path !== "string") {
    throw new Error(`${paramName} must be a non-empty string`);
  }
  // Prevent path traversal attempts
  if (path.includes("..")) {
    throw new Error(`${paramName} contains invalid path traversal sequence`);
  }
};

const validateFileName = (fileName: string): void => {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("fileName must be a non-empty string");
  }
  // Check for path separators
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("fileName must not contain path separators");
  }
  // Check for illegal characters (common across platforms)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally checking for control characters
  const illegalChars = /[<>:"|?*\x00-\x1f]/;
  if (illegalChars.test(fileName)) {
    throw new Error("fileName contains illegal characters");
  }
};

const validateUrl = (url: string): void => {
  try {
    const parsed = new URL(url);
    // Only allow safe schemes
    const allowedSchemes = ["http:", "https:", "mailto:"];
    if (!allowedSchemes.includes(parsed.protocol)) {
      throw new Error(
        `URL scheme '${
          parsed.protocol
        }' is not allowed. Only ${allowedSchemes.join(", ")} are permitted`
      );
    }
  } catch (e) {
    throw new Error(
      `Invalid URL: ${e instanceof Error ? e.message : String(e)}`
    );
  }
};

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

export interface QueryResultBlock {
  id: string;
  pageId: string;
  parentId: string | null;
  content: string;
  orderWeight: number;
  isCollapsed: boolean;
  blockType: "bullet" | "code" | "fence";
  language?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
  pagePath: string;
}

export interface QueryResult {
  blocks: QueryResultBlock[];
  totalCount: number;
  error?: string;
}

export interface SearchResult {
  id: string;
  pageId: string;
  pageTitle: string;
  resultType: "page" | "block";
  content: string;
  snippet: string;
  rank: number;
}

export const tauriAPI = {
  // Workspace operations
  selectWorkspace: async (): Promise<string | null> => {
    return await invoke<string | null>("select_workspace");
  },

  // Search operations
  searchContent: async (
    workspacePath: string,
    query: string
  ): Promise<SearchResult[]> => {
    const searchLogger = {
      log: (...args: unknown[]) =>
        console.log("[tauriAPI.searchContent]", ...args),
      info: (...args: unknown[]) =>
        console.info("[tauriAPI.searchContent]", ...args),
      error: (...args: unknown[]) =>
        console.error("[tauriAPI.searchContent]", ...args),
    };

    searchLogger.log("Initiating search request");
    searchLogger.log("Query:", query);
    searchLogger.log("Workspace:", workspacePath);

    validatePath(workspacePath, "workspacePath");
    if (!query || typeof query !== "string") {
      searchLogger.error("Invalid query parameter");
      throw new Error("query must be a non-empty string");
    }

    try {
      searchLogger.info("Calling Tauri invoke('search_content')");
      const startTime = performance.now();

      const results = await invoke<SearchResult[]>("search_content", {
        workspacePath,
        query,
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      searchLogger.info(`✓ Search completed in ${duration}ms`);
      searchLogger.info(`Results received: ${results.length} items`);
      searchLogger.log(
        "Results summary:",
        results.slice(0, 3).map((r) => ({
          title: r.pageTitle,
          type: r.resultType,
          rank: r.rank,
        }))
      );

      return results;
    } catch (error) {
      searchLogger.error("Search request failed");
      searchLogger.error("Error:", error);
      throw error;
    }
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
    validatePath(dirPath, "dirPath");
    return await invoke<FileSystemItem[]>("read_directory", { dirPath });
  },

  readFile: async (filePath: string): Promise<string> => {
    validatePath(filePath, "filePath");
    return await invoke<string>("read_file", { filePath });
  },

  writeFile: async (filePath: string, content: string): Promise<boolean> => {
    validatePath(filePath, "filePath");
    return await invoke<boolean>("write_file", { filePath, content });
  },

  createFile: async (dirPath: string, fileName: string): Promise<string> => {
    validatePath(dirPath, "dirPath");
    validateFileName(fileName);
    return await invoke<string>("create_file", { dirPath, fileName });
  },

  createDirectory: async (
    parentPath: string,
    dirName: string
  ): Promise<string> => {
    validatePath(parentPath, "parentPath");
    validateFileName(dirName);
    return await invoke<string>("create_directory", { parentPath, dirName });
  },

  deletePath: async (targetPath: string): Promise<boolean> => {
    validatePath(targetPath, "targetPath");
    return await invoke<boolean>("delete_path", { targetPath });
  },

  deletePathWithDb: async (
    workspacePath: string,
    targetPath: string
  ): Promise<boolean> => {
    validatePath(workspacePath, "workspacePath");
    validatePath(targetPath, "targetPath");
    return await invoke<boolean>("delete_path_with_db", {
      workspacePath,
      targetPath,
    });
  },

  renamePath: async (oldPath: string, newName: string): Promise<string> => {
    validatePath(oldPath, "oldPath");
    validateFileName(newName);
    return await invoke<string>("rename_path", { oldPath, newName });
  },

  movePath: async (
    sourcePath: string,
    targetParentPath: string
  ): Promise<string> => {
    validatePath(sourcePath, "sourcePath");
    validatePath(targetParentPath, "targetParentPath");
    return await invoke<string>("move_path", { sourcePath, targetParentPath });
  },

  convertFileToDirectory: async (filePath: string): Promise<string> => {
    validatePath(filePath, "filePath");
    return await invoke<string>("convert_file_to_directory", { filePath });
  },

  getPathInfo: async (targetPath: string): Promise<PathInfo> => {
    validatePath(targetPath, "targetPath");
    return await invoke<PathInfo>("get_path_info", { targetPath });
  },

  // Links / references
  rewriteWikiLinksForPagePathChange: async (
    workspacePath: string,
    fromPath: string,
    toPath: string
  ): Promise<number> => {
    validatePath(workspacePath, "workspacePath");
    validatePath(fromPath, "fromPath");
    validatePath(toPath, "toPath");
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
    validatePath(workspacePath, "workspacePath");
    return await invoke<{ pages: number; blocks: number }>(
      "sync_workspace_incremental",
      { workspacePath }
    );
  },

  reindexWorkspace: async (
    workspacePath: string
  ): Promise<{ pages: number; blocks: number }> => {
    validatePath(workspacePath, "workspacePath");
    return await invoke<{ pages: number; blocks: number }>(
      "reindex_workspace",
      { workspacePath }
    );
  },

  // DB Maintenance
  vacuumDb: async (workspacePath: string): Promise<void> => {
    validatePath(workspacePath, "workspacePath");
    return await invoke<void>("vacuum_db", { workspacePath });
  },

  optimizeDb: async (workspacePath: string): Promise<void> => {
    validatePath(workspacePath, "workspacePath");
    return await invoke<void>("optimize_db", { workspacePath });
  },

  repairDb: async (workspacePath: string): Promise<string> => {
    validatePath(workspacePath, "workspacePath");
    return await invoke<string>("repair_db", { workspacePath });
  },

  // Query operations
  executeQueryMacro: async (
    workspacePath: string,
    queryString: string
  ): Promise<QueryResult> => {
    validatePath(workspacePath, "workspacePath");
    if (!queryString || typeof queryString !== "string") {
      throw new Error("queryString must be a non-empty string");
    }
    return await invoke<QueryResult>("execute_query_macro", {
      workspacePath,
      queryString,
    });
  },
};

// Export validation utilities for use in other modules
export { validatePath, validateFileName, validateUrl };
