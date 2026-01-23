import { useErrorStore } from "@/stores/errorStore";
import { usePageStore } from "@/stores/pageStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { tauriAPI } from "@/tauri-api";

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
  const { setError: setWorkspaceError, clearError: clearWorkspaceError } =
    useWorkspaceStore();
  const addError = useErrorStore((state) => state.addError);

  // Use refs to keep track of the latest callbacks without triggering re-effects
  const onInitialCompleteRef = useRef(onInitialComplete);
  const onWorkspaceNameSetRef = useRef(onWorkspaceNameSet);

  useEffect(() => {
    onInitialCompleteRef.current = onInitialComplete;
    onWorkspaceNameSetRef.current = onWorkspaceNameSet;
  }, [onInitialComplete, onWorkspaceNameSet]);

  useEffect(() => {
    if (!workspacePath) {
      setIsChecking(false);
      setIsInitialized(false);
      return;
    }

    const initializeWorkspace = async () => {
      setIsChecking(true);
      try {
        // Validate that the workspace path exists before attempting to sync
        console.log(
          "[useWorkspaceInitializer] Validating workspace path exists...",
        );
        try {
          await tauriAPI.readDirectory(workspacePath);
        } catch (pathError) {
          const pathErrorMessage =
            pathError instanceof Error
              ? pathError.message
              : "Unknown error occurred";
          throw new Error(
            `Workspace path validation failed: ${pathErrorMessage}`,
          );
        }

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
        clearWorkspaceError();

        const workspaceName = workspacePath.split("/").pop() || "Workspace";
        onWorkspaceNameSetRef.current(workspaceName);

        onInitialCompleteRef.current();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error(
          "[useWorkspaceInitializer] Failed to sync workspace:",
          error,
        );

        setIsInitialized(false);
        setShowMigration(false);

        let userMessage = "Failed to initialize workspace";
        if (
          errorMessage.includes("validation failed") ||
          errorMessage.includes("Workspace path")
        ) {
          userMessage =
            "Workspace folder not found or inaccessible. The saved location may have been moved or deleted.";
        } else if (
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

        // Set error in workspace store so WorkspaceSelector can display it
        setWorkspaceError(userMessage);

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
    addError,
    setWorkspaceError,
    clearWorkspaceError,
  ]);

  const handleMigrationComplete = async () => {
    setShowMigration(false);
    setIsInitialized(true);
    try {
      await invoke("sync_workspace", { workspacePath });
      await loadPages();

      clearWorkspaceError();

      const workspaceName = workspacePath.split("/").pop() || "Workspace";
      onWorkspaceNameSetRef.current(workspaceName);

      onInitialCompleteRef.current();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useWorkspaceInitializer] Failed after migration:", error);
      setShowMigration(true);
      setIsInitialized(false);

      // Set error in workspace store so WorkspaceSelector can display it
      setWorkspaceError(`Migration failed: ${errorMessage}`);

      addError(`Migration failed: ${errorMessage}`, {
        type: "error",
        details: String(error),
      });
    }
  };

  const handleMigrationCancel = () => {
    setShowMigration(false);
    setIsInitialized(false);
  };

  return {
    isChecking,
    isInitialized,
    showMigration,
    handleMigrationComplete,
    handleMigrationCancel,
  };
};
