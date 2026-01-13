import { invoke } from "@tauri-apps/api/core";
import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";

interface GitStatus {
  is_repo: boolean;
  has_changes: boolean;
  changed_files: string[];
  current_branch: string;
  remote_url?: string;
}

interface GitCommitResult {
  success: boolean;
  message: string;
  commit_hash?: string;
}

interface GitState {
  // Settings
  autoCommitEnabled: boolean;
  autoCommitInterval: number; // in minutes
  lastAutoCommit: number; // timestamp

  // Status
  isRepo: boolean;
  hasChanges: boolean;
  currentBranch: string;
  remoteUrl: string | null;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;

  // Actions
  setAutoCommitEnabled: (enabled: boolean) => void;
  setAutoCommitInterval: (interval: number) => void;
  initGit: (workspacePath: string) => Promise<boolean>;
  checkStatus: (workspacePath: string) => Promise<void>;
  commit: (workspacePath: string, message: string) => Promise<GitCommitResult>;
  push: (workspacePath: string) => Promise<void>;
  pull: (workspacePath: string) => Promise<void>;
  autoCommit: (workspacePath: string) => Promise<void>;
  getRemoteUrl: (workspacePath: string) => Promise<string | null>;
  setRemoteUrl: (workspacePath: string, url: string) => Promise<void>;
  removeRemote: (workspacePath: string) => Promise<void>;
}

export const useGitStore = createWithEqualityFn<GitState>()(
  persist(
    (set, get) => ({
      // Initial State
      autoCommitEnabled: false,
      autoCommitInterval: 5, // 5 minutes default
      lastAutoCommit: 0,
      isRepo: false,
      hasChanges: false,
      currentBranch: "",
      remoteUrl: null,
      isCommitting: false,
      isPushing: false,
      isPulling: false,

      // Actions
      setAutoCommitEnabled: (enabled: boolean) => {
        set({ autoCommitEnabled: enabled });
      },

      setAutoCommitInterval: (interval: number) => {
        set({ autoCommitInterval: interval });
      },

      initGit: async (workspacePath: string) => {
        try {
          // First check if it's already a repo
          const isRepo = await invoke<boolean>("git_is_repo", {
            workspacePath,
          });

          if (isRepo) {
            set({ isRepo: true });
            await get().checkStatus(workspacePath);
            return true;
          }

          // If not, try to init
          const result = await invoke<boolean>("git_init", { workspacePath });
          if (result) {
            set({ isRepo: true });
            await get().checkStatus(workspacePath);
          }
          return result;
        } catch (error) {
          console.error("[GitStore] Failed to init git:", error);
          set({ isRepo: false });
          return false;
        }
      },

      checkStatus: async (workspacePath: string) => {
        try {
          const status = await invoke<GitStatus>("git_status", {
            workspacePath,
          });
          set({
            isRepo: status.is_repo,
            hasChanges: status.has_changes,
            currentBranch: status.current_branch,
            remoteUrl: status.remote_url || null,
          });
        } catch (error) {
          console.error("[GitStore] Failed to check status:", error);
        }
      },

      commit: async (workspacePath: string, message: string) => {
        set({ isCommitting: true });
        try {
          const result = await invoke<GitCommitResult>("git_commit", {
            workspacePath,
            message,
          });

          if (result.success) {
            set({ lastAutoCommit: Date.now() });
            await get().checkStatus(workspacePath);
          }

          return result;
        } catch (error) {
          console.error("[GitStore] Failed to commit:", error);
          return {
            success: false,
            message: error instanceof Error ? error.message : "Commit failed",
          };
        } finally {
          set({ isCommitting: false });
        }
      },

      push: async (workspacePath: string) => {
        set({ isPushing: true });
        try {
          await invoke("git_push", { workspacePath });
          await get().checkStatus(workspacePath);
        } catch (error) {
          console.error("[GitStore] Failed to push:", error);
          throw error;
        } finally {
          set({ isPushing: false });
        }
      },

      pull: async (workspacePath: string) => {
        set({ isPulling: true });
        try {
          await invoke("git_pull", { workspacePath });
          await get().checkStatus(workspacePath);
        } catch (error) {
          console.error("[GitStore] Failed to pull:", error);
          throw error;
        } finally {
          set({ isPulling: false });
        }
      },

      autoCommit: async (workspacePath: string) => {
        const state = get();
        if (!state.autoCommitEnabled || !state.isRepo || !state.hasChanges) {
          return;
        }

        const now = Date.now();
        const timeSinceLastCommit = now - state.lastAutoCommit;
        const intervalMs = state.autoCommitInterval * 60 * 1000;

        if (timeSinceLastCommit >= intervalMs) {
          const timestamp = new Date().toISOString();
          await get().commit(workspacePath, `Auto-commit: ${timestamp}`);
        }
      },

      getRemoteUrl: async (workspacePath: string) => {
        try {
          const url = await invoke<string | null>("git_get_remote_url", {
            workspacePath,
          });
          set({ remoteUrl: url });
          return url;
        } catch (error) {
          console.error("[GitStore] Failed to get remote URL:", error);
          return null;
        }
      },

      setRemoteUrl: async (workspacePath: string, url: string) => {
        try {
          await invoke("git_set_remote_url", {
            workspacePath,
            url,
          });
          set({ remoteUrl: url });
          await get().checkStatus(workspacePath);
        } catch (error) {
          console.error("[GitStore] Failed to set remote URL:", error);
          throw error;
        }
      },

      removeRemote: async (workspacePath: string) => {
        try {
          await invoke("git_remove_remote", {
            workspacePath,
          });
          set({ remoteUrl: null });
          await get().checkStatus(workspacePath);
        } catch (error) {
          console.error("[GitStore] Failed to remove remote:", error);
          throw error;
        }
      },
    }),
    {
      name: "git-settings",
      partialize: (state) => ({
        autoCommitEnabled: state.autoCommitEnabled,
        autoCommitInterval: state.autoCommitInterval,
        lastAutoCommit: state.lastAutoCommit,
      }),
    },
  ),
);
