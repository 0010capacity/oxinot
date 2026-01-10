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
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "300px",
      }}
    >
      <Group gap={8} justify="center" mb={6}>
        <IconRefresh
          size={12}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <Text size="xs" c="dimmed">
          {message || "Re-indexing..."}
        </Text>
        <Text size="xs" c="dimmed">
          {Math.round(progress)}%
        </Text>
      </Group>
      <Progress
        value={progress}
        size={3}
        radius="xl"
        styles={{
          root: {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
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
