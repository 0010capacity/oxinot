import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePageStore } from "@/stores/pageStore";
import { useErrorStore } from "@/stores/errorStore";

export interface WorkspaceInitializerState {
  isChecking: boolean;
  isInitialized: boolean;
  showMigration: boolean;
}

export interface WorkspaceInitializerActions {
  handleMigrationComplete: () => Promise<void>;
  handleMigrationCancel: () => void;
}

export const useWorkspaceInitializer = (
  workspacePath: string,
  onInitialComplete: () => void,
  onWorkspaceNameSet: (name: string) => void,
): WorkspaceInitializerState & WorkspaceInitializerActions => {
  const [isChecking, setIsChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  const { loadPages } = usePageStore();
  const addError = useErrorStore((state) => state.addError);

  useEffect(() => {
    if (!workspacePath) {
      setIsChecking(false);
      setIsInitialized(false);
      return;
    }

    const initializeWorkspace = async () => {
      setIsChecking(true);
      try {
        console.log(
          "[useWorkspaceInitializer] Syncing workspace with filesystem...",
        );
        const syncResult = await invoke<{ pages: number; blocks: number }>(
          "sync_workspace",
          { workspacePath },
        );
        console.log(
          `[useWorkspaceInitializer] Workspace synced: ${syncResult.pages} pages, ${syncResult.blocks} blocks`,
        );

        await loadPages();
        setIsInitialized(true);
        setShowMigration(false);

        const workspaceName = workspacePath.split("/").pop() || "Workspace";
        onWorkspaceNameSet(workspaceName);

        onInitialComplete();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error(
          "[useWorkspaceInitializer] Failed to sync workspace:",
          error,
        );

        setIsInitialized(false);
        setShowMigration(true);

        let userMessage = "Failed to initialize workspace";
        if (
          errorMessage.includes("permission") ||
          errorMessage.includes("access")
        ) {
          userMessage = "Permission denied: Check folder access permissions";
        } else if (
          errorMessage.includes("database") ||
          errorMessage.includes("corrupt")
        ) {
          userMessage = "Database error: Migration may be required";
        } else if (errorMessage.includes("not found")) {
          userMessage = "Workspace folder not found";
        }

        addError(userMessage, {
          type: "error",
          details: errorMessage,
        });
      } finally {
        setIsChecking(false);
      }
    };

    initializeWorkspace();
  }, [
    workspacePath,
    loadPages,
    onInitialComplete,
    onWorkspaceNameSet,
    addError,
  ]);

  const handleMigrationComplete = async () => {
    setShowMigration(false);
    setIsInitialized(true);
    try {
      await invoke("sync_workspace", { workspacePath });
      await loadPages();

      const workspaceName = workspacePath.split("/").pop() || "Workspace";
      onWorkspaceNameSet(workspaceName);

      onInitialComplete();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useWorkspaceInitializer] Failed after migration:", error);
      setShowMigration(true);

      addError(`Migration failed: ${errorMessage}`, {
        type: "error",
        details: String(error),
      });
    }
  };

  const handleMigrationCancel = () => {
    setShowMigration(false);
  };

  return {
    isChecking,
    isInitialized,
    showMigration,
    handleMigrationComplete,
    handleMigrationCancel,
  };
};
