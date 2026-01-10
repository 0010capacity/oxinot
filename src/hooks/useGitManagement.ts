import { useEffect, useState } from "react";
import { useGitStore } from "@/stores/gitStore";
import { showToast } from "@/utils/toast";
import { useErrorStore } from "@/stores/errorStore";

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

export const useGitManagement = (
  workspacePath: string,
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

  useEffect(() => {
    if (!workspacePath || !isGitRepo) return;

    const intervalId = setInterval(() => {
      checkGitStatus(workspacePath).catch((error) => {
        console.error("[useGitManagement] Status check failed:", error);
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [workspacePath, isGitRepo, checkGitStatus]);

  useEffect(() => {
    if (!workspacePath || !autoCommitEnabled) return;

    const intervalId = setInterval(
      () => {
        autoCommit(workspacePath).catch((error) => {
          console.error("[useGitManagement] Auto-commit failed:", error);
        });
      },
      autoCommitInterval * 60 * 1000,
    );

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
