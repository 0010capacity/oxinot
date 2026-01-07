import { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Progress,
  Alert,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";

interface MigrationDialogProps {
  workspacePath: string;
  isOpen: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

type MigrationStep =
  | "idle"
  | "initializing"
  | "importing"
  | "complete"
  | "error";

interface MigrationProgress {
  step: MigrationStep;
  message: string;
  progress: number; // 0-100
  error?: string;
  pagesCreated?: number;
  blocksCreated?: number;
}

export function MigrationDialog({
  workspacePath,
  isOpen,
  onComplete,
  onCancel,
}: MigrationDialogProps) {
  const [migrationState, setMigrationState] = useState<MigrationProgress>({
    step: "idle",
    message: "",
    progress: 0,
  });

  const handleStartMigration = async () => {
    setMigrationState({
      step: "initializing",
      message: "Initializing database...",
      progress: 10,
    });

    try {
      // Initialize database schema
      await invoke("init_workspace_db");

      setMigrationState({
        step: "importing",
        message: "Importing markdown files...",
        progress: 50,
      });

      // 마이그레이션 시작
      const result = await invoke("migrate_workspace", {
        workspacePath,
      });

      console.log("Migration result:", result);

      // 약간의 지연 후 완료
      setTimeout(() => {
        setMigrationState({
          step: "complete",
          message: "Migration completed successfully!",
          progress: 100,
          pagesCreated: (result as any).pages || 0,
          blocksCreated: (result as any).blocks || 0,
        });
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setMigrationState({
        step: "error",
        message: "Migration failed",
        progress: 0,
        error: errorMessage,
      });
    }
  };

  const handleComplete = () => {
    setMigrationState({
      step: "idle",
      message: "",
      progress: 0,
    });
    onComplete();
  };

  const handleCancel = () => {
    setMigrationState({
      step: "idle",
      message: "",
      progress: 0,
    });
    onCancel();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleCancel}
      title="Initialize Workspace"
      centered
      size="sm"
      withCloseButton={
        migrationState.step === "idle" || migrationState.step === "complete"
      }
      closeOnEscape={migrationState.step === "idle"}
      closeOnClickOutside={migrationState.step === "idle"}
    >
      <Stack gap="md">
        {/* Status Message */}
        <Text size="sm" c="dimmed">
          {migrationState.message}
        </Text>

        {/* Progress Bar */}
        {migrationState.step !== "idle" && (
          <Progress
            value={migrationState.progress}
            color={
              migrationState.step === "error"
                ? "red"
                : migrationState.step === "complete"
                  ? "green"
                  : "blue"
            }
            animated={
              migrationState.step !== "complete" &&
              migrationState.step !== "error"
            }
          />
        )}

        {/* Loading Spinner */}
        {migrationState.step === "initializing" ||
        migrationState.step === "importing" ? (
          <Group justify="center">
            <Loader size="sm" />
            <Text size="sm">Processing...</Text>
          </Group>
        ) : null}

        {/* Success State */}
        {migrationState.step === "complete" && (
          <Alert icon={<IconCheck size={16} />} color="green" title="Success">
            <Stack gap="xs">
              <Text size="sm">
                ✅ Created {migrationState.pagesCreated || 0} page(s)
              </Text>
              <Text size="sm">
                ✅ Imported {migrationState.blocksCreated || 0} block(s)
              </Text>
              <Text size="sm" c="dimmed">
                Your workspace is ready to use!
              </Text>
            </Stack>
          </Alert>
        )}

        {/* Error State */}
        {migrationState.step === "error" && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            <Stack gap="xs">
              <Text size="sm">{migrationState.error}</Text>
              <Text size="xs" c="dimmed">
                Please check that your workspace contains valid markdown files
                and try again.
              </Text>
            </Stack>
          </Alert>
        )}

        {/* Initial State - Show Options */}
        {migrationState.step === "idle" && (
          <Stack gap="sm">
            <Text size="sm">
              This workspace needs to be initialized. MD Outliner will:
            </Text>
            <ul
              style={{
                margin: "0.5rem 0",
                paddingLeft: "1.5rem",
                fontSize: "0.875rem",
              }}
            >
              <li>Create a database file (outliner.db)</li>
              <li>Import existing markdown files from this folder</li>
              <li>Build the outline structure</li>
            </ul>
            <Text size="xs" c="dimmed">
              Workspace: {workspacePath}
            </Text>
          </Stack>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          {migrationState.step === "idle" && (
            <>
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleStartMigration}>
                Initialize Workspace
              </Button>
            </>
          )}

          {migrationState.step === "complete" && (
            <Button onClick={handleComplete} color="green">
              Continue
            </Button>
          )}

          {migrationState.step === "error" && (
            <>
              <Button variant="default" onClick={handleCancel}>
                Close
              </Button>
              <Button onClick={handleStartMigration} color="orange">
                Retry
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
