import { useGitManagement } from "@/hooks/useGitManagement";
import { Button, Stack, Text, useMantineColorScheme } from "@mantine/core";

interface GitStatusIndicatorProps {
  workspacePath: string;
}

/**
 * GitStatusIndicator component displays the current Git status and provides
 * quick access to common Git operations (commit, push, pull).
 *
 * Features:
 * - Visual indicator dot showing changes status
 * - Hover menu with Git operations
 * - Quick commit on dot click
 * - Status tooltips
 */
export const GitStatusIndicator = ({
  workspacePath,
}: GitStatusIndicatorProps) => {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const {
    hasChanges,
    isRepo,
    isPushing,
    isPulling,
    remoteUrl,
    gitMenuOpen,
    setGitMenuOpen,
    handleGitCommit,
    handleGitPush,
    handleGitPull,
  } = useGitManagement(workspacePath);

  if (!isRepo) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "12px",
        right: "12px",
        zIndex: 1000,
      }}
      onMouseEnter={() => setGitMenuOpen(true)}
      onMouseLeave={() => setGitMenuOpen(false)}
    >
      {/* Status Dot */}
      <button
        type="button"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: hasChanges
            ? isDark
              ? "#ffd43b"
              : "#fab005"
            : isDark
              ? "#5c5f66"
              : "#adb5bd",
          cursor: "pointer",
          opacity: hasChanges ? 1 : 0.4,
          transition: "opacity 0.2s ease, background-color 0.2s ease",
          border: "none",
          padding: 0,
        }}
        onClick={handleGitCommit}
        title={hasChanges ? "Click to commit changes" : "No changes"}
      />

      {/* Hover Menu */}
      {gitMenuOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "0",
            backgroundColor: isDark ? "#25262b" : "#ffffff",
            border: `1px solid ${isDark ? "#373A40" : "#DEE2E6"}`,
            borderRadius: "6px",
            padding: "8px",
            minWidth: "140px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          <Stack gap={4}>
            <Button
              size="xs"
              variant="subtle"
              fullWidth
              onClick={handleGitCommit}
              disabled={!hasChanges}
              style={{ justifyContent: "flex-start" }}
            >
              {hasChanges ? "Commit" : "No Changes"}
            </Button>
            {remoteUrl && (
              <>
                <Button
                  size="xs"
                  variant="subtle"
                  fullWidth
                  onClick={handleGitPush}
                  disabled={isPushing}
                  style={{ justifyContent: "flex-start" }}
                >
                  {isPushing ? "Pushing..." : "Push"}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  fullWidth
                  onClick={handleGitPull}
                  disabled={isPulling}
                  style={{ justifyContent: "flex-start" }}
                >
                  {isPulling ? "Pulling..." : "Pull"}
                </Button>
              </>
            )}
            {!remoteUrl && (
              <Text size="xs" c="dimmed" px={8} py={4}>
                No remote set
              </Text>
            )}
          </Stack>
        </div>
      )}
    </div>
  );
};
