import { Box, Progress, Text, Group } from "@mantine/core";
import { useSyncStore } from "../stores/syncStore";
import { IconRefresh } from "@tabler/icons-react";

export function SyncProgress() {
  const { isReindexing, progress, message } = useSyncStore();

  if (!isReindexing) {
    return null;
  }

  return (
    <Box
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--mantine-color-dark-7)",
        borderTop: "1px solid var(--mantine-color-dark-4)",
        padding: "8px 16px",
        zIndex: 1000,
      }}
    >
      <Group gap={12} justify="space-between">
        <Group gap={8} style={{ flex: 1 }}>
          <IconRefresh size={14} style={{ animation: "spin 1s linear infinite" }} />
          <Text size="xs" c="dimmed">
            {message || "Re-indexing workspace..."}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" style={{ minWidth: "40px", textAlign: "right" }}>
          {Math.round(progress)}%
        </Text>
      </Group>
      <Progress
        value={progress}
        size="xs"
        mt={4}
        styles={{
          root: {
            backgroundColor: "var(--mantine-color-dark-6)",
          },
        }}
      />
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </Box>
  );
}
