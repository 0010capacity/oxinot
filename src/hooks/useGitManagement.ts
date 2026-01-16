import { watch } from "@tauri-apps/plugin-fs";
import { useErrorStore } from "@/stores/errorStore";
import { useGitStore } from "@/stores/gitStore";
import { showToast } from "@/utils/toast";
import { useEffect, useState } from "react";

export interface GitManagementState {
  hasChanges: boolean;
  isRepo: boolean;
  isPushing: boolean;
  isPulling: boolean;
  remoteUrl: string | null;
  autoCommitEnabled: boolean;
  autoCommitInterval: number;
  gitMenuOpen: boolean;
}

export interface GitManagementActions {
  handleGitCommit: () => Promise<void>;
  handleGitPush: () => Promise<void>;
  handleGitPull: () => Promise<void>;
  setGitMenuOpen: (open: boolean) => void;
}

// Debounce delay for file watcher events (500ms)
// Allows batching of multiple file changes into a single git status check
const GIT_WATCHER_DEBOUNCE_MS = 500;

export const useGitManagement = (
  workspacePath: string
): GitManagementState & GitManagementActions => {
  const hasGitChanges = useGitStore((state) => state.hasChanges);
  const isGitRepo = useGitStore((state) => state.isRepo);
  const initGit = useGitStore((state) => state.initGit);
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const gitCommit = useGitStore((state) => state.commit);
  const gitPush = useGitStore((state) => state.push);
  const gitPull = useGitStore((state) => state.pull);
  const isPushing = useGitStore((state) => state.isPushing);
  const isPulling = useGitStore((state) => state.isPulling);
  const remoteUrl = useGitStore((state) => state.remoteUrl);
  const autoCommitEnabled = useGitStore((state) => state.autoCommitEnabled);
  const autoCommitInterval = useGitStore((state) => state.autoCommitInterval);
  const autoCommit = useGitStore((state) => state.autoCommit);

  const addError = useErrorStore((state) => state.addError);
  const [gitMenuOpen, setGitMenuOpen] = useState(false);

  // Initialize Git on workspace load
  useEffect(() => {
    if (!workspacePath) return;

    const initializeGit = async () => {
      try {
        await initGit(workspacePath);
        await checkGitStatus(workspacePath);
      } catch (error) {
        console.error("[useGitManagement] Failed to initialize git:", error);
      }
    };

    initializeGit();
  }, [workspacePath, initGit, checkGitStatus]);

  // File system watcher: detect changes and check git status
  // Uses debounced watcher to batch multiple file changes
  useEffect(() => {
    if (!workspacePath || !isGitRepo) return;

    let unwatchPromise: Promise<() => void> | null = null;
    let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const startWatcher = async () => {
      try {
        // Watch workspace directory for changes with debounce
        // 'watch' provides debounced events, avoiding excessive git status checks
        unwatchPromise = watch(
          ".",
          () => {
            // Debounce: only check git status after changes settle
            if (debounceTimeoutId) {
              clearTimeout(debounceTimeoutId);
            }

            debounceTimeoutId = setTimeout(() => {
              checkGitStatus(workspacePath).catch((error) => {
                console.error(
                  "[useGitManagement] File watcher git status check failed:",
                  error
                );
              });
            }, GIT_WATCHER_DEBOUNCE_MS);
          },
          {
            recursive: true,
            delayMs: 300, // Tauri's built-in debounce for watcher events
          }
        );

        console.debug(
          "[useGitManagement] File system watcher started for workspace:",
          workspacePath
        );
      } catch (error) {
        console.error(
          "[useGitManagement] Failed to start file watcher:",
          error
        );
        // Fallback: use polling if watcher fails
        const fallbackIntervalId = setInterval(() => {
          checkGitStatus(workspacePath).catch((error) => {
            console.error(
              "[useGitManagement] Fallback polling git status check failed:",
              error
            );
          });
        }, 10000); // 10 second fallback polling

        return () => clearInterval(fallbackIntervalId);
      }
    };

    startWatcher();

    return () => {
      // Cleanup: stop watching and clear debounce timeout
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
      }

      unwatchPromise?.then((unwatch) => {
        unwatch();
      });
    };
  }, [workspacePath, isGitRepo, checkGitStatus]);

  // Auto-commit on configured interval
  useEffect(() => {
    if (!workspacePath || !autoCommitEnabled) return;

    const intervalId = setInterval(() => {
      autoCommit(workspacePath).catch((error) => {
        console.error("[useGitManagement] Auto-commit failed:", error);
      });
    }, autoCommitInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [workspacePath, autoCommitEnabled, autoCommitInterval, autoCommit]);

  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;

    const timestamp = new Date().toLocaleString();
    try {
      const result = await gitCommit(workspacePath, `Update: ${timestamp}`);
      if (result.success) {
        showToast({ message: "Changes committed", type: "success" });
      } else {
        addError("Failed to commit changes", {
          type: "error",
          details: result.message || "Unknown error",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useGitManagement] Commit failed:", error);
      addError(`Failed to commit changes: ${errorMessage}`, {
        type: "error",
        details: String(error),
      });
    }
  };

  const handleGitPush = async () => {
    if (!workspacePath || !remoteUrl) return;

    try {
      await gitPush(workspacePath);
      showToast({ message: "Changes pushed to remote", type: "success" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useGitManagement] Push failed:", error);

      let userMessage = "Failed to push changes";
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("connection")
      ) {
        userMessage = "Network error: Check your internet connection";
      } else if (errorMessage.includes("authentication")) {
        userMessage = "Authentication failed: Check your Git credentials";
      } else if (errorMessage.includes("conflict")) {
        userMessage = "Push rejected: Resolve conflicts and try again";
      }

      addError(userMessage, {
        type: "error",
        details: errorMessage,
      });
    }
  };

  const handleGitPull = async () => {
    if (!workspacePath || !remoteUrl) return;

    try {
      await gitPull(workspacePath);
      showToast({ message: "Changes pulled from remote", type: "success" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useGitManagement] Pull failed:", error);

      let userMessage = "Failed to pull changes";
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("connection")
      ) {
        userMessage = "Network error: Check your internet connection";
      } else if (errorMessage.includes("authentication")) {
        userMessage = "Authentication failed: Check your Git credentials";
      } else if (errorMessage.includes("conflict")) {
        userMessage = "Merge conflict detected: Resolve manually and commit";
      }

      addError(userMessage, {
        type: "error",
        details: errorMessage,
      });
    }
  };

  return {
    hasChanges: hasGitChanges,
    isRepo: isGitRepo,
    isPushing,
    isPulling,
    remoteUrl,
    autoCommitEnabled,
    autoCommitInterval,
    gitMenuOpen,
    handleGitCommit,
    handleGitPush,
    handleGitPull,
    setGitMenuOpen,
  };
};
