import { watch } from "@tauri-apps/plugin-fs";
import { useErrorStore } from "@/stores/errorStore";
import { useGitStore } from "@/stores/gitStore";
import { showToast } from "@/utils/toast";
import { useEffect, useRef, useState } from "react";

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

// Simple logger for git monitoring
const logger = {
  info: (msg: string, data?: unknown) => {
    console.log(`[GitMonitor] ${msg}`, data ? data : "");
  },
  debug: (msg: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[GitMonitor] ${msg}`, data ? data : "");
    }
  },
  error: (msg: string, error?: unknown) => {
    console.error(`[GitMonitor] ${msg}`, error ? error : "");
  },
};

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
  const watcherInitializedRef = useRef(false);
  const fileChangeCountRef = useRef(0);

  useEffect(() => {
    if (!workspacePath || !isGitRepo) return;

    let unwatchPromise: Promise<() => void> | null = null;
    let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const watcherStartTime = Date.now();

    const startWatcher = async () => {
      try {
        logger.info("Starting file system watcher", { workspacePath });
        watcherInitializedRef.current = true;

        // Watch workspace directory for changes with debounce
        // 'watch' provides debounced events, avoiding excessive git status checks
        unwatchPromise = watch(
          ".",
          () => {
            fileChangeCountRef.current += 1;
            const changeCount = fileChangeCountRef.current;

            logger.debug("File change detected", {
              changeNumber: changeCount,
              elapsedMs: Date.now() - watcherStartTime,
            });

            // Debounce: only check git status after changes settle
            if (debounceTimeoutId) {
              logger.debug("Clearing previous debounce timer", {
                changeNumber: changeCount,
              });
              clearTimeout(debounceTimeoutId);
            }

            debounceTimeoutId = setTimeout(() => {
              logger.info("Debounce settled, checking git status", {
                changeNumber: changeCount,
                debounceDelayMs: GIT_WATCHER_DEBOUNCE_MS,
              });

              checkGitStatus(workspacePath)
                .then(() => {
                  logger.debug("Git status check completed", {
                    changeNumber: changeCount,
                  });
                })
                .catch((error) => {
                  logger.error("File watcher git status check failed", error);
                });
            }, GIT_WATCHER_DEBOUNCE_MS);
          },
          {
            recursive: true,
            delayMs: 300, // Tauri's built-in debounce for watcher events
          }
        );

        logger.info("File system watcher initialized successfully", {
          workspace: workspacePath,
          recursive: true,
          tauroDebounceMs: 300,
          appDebounceMs: GIT_WATCHER_DEBOUNCE_MS,
        });
      } catch (error) {
        logger.error(
          "Failed to start file watcher, using fallback polling",
          error
        );
        watcherInitializedRef.current = false;

        // Fallback: use polling if watcher fails
        const fallbackIntervalId = setInterval(() => {
          logger.debug("Fallback polling: checking git status");

          checkGitStatus(workspacePath)
            .then(() => {
              logger.debug("Fallback polling: git status check completed");
            })
            .catch((error) => {
              logger.error("Fallback polling git status check failed", error);
            });
        }, 10000); // 10 second fallback polling

        return () => {
          logger.info("Cleaning up fallback polling");
          clearInterval(fallbackIntervalId);
        };
      }
    };

    startWatcher();

    return () => {
      logger.info("Cleaning up file system watcher", {
        workspace: workspacePath,
        fileChangesDetected: fileChangeCountRef.current,
      });

      // Cleanup: stop watching and clear debounce timeout
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
      }

      unwatchPromise
        ?.then((unwatch) => {
          unwatch();
          logger.debug("Watcher unsubscribed successfully");
        })
        .catch((error) => {
          logger.error("Error unsubscribing watcher", error);
        });

      watcherInitializedRef.current = false;
      fileChangeCountRef.current = 0;
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
