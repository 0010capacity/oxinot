import { useChatStore } from "@/stores/chatStore";
import { Z_INDEX } from "@/theme/tokens";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { memo } from "react";

export const CopilotFab = memo(function CopilotFab() {
  const isOpen = useChatStore((s) => s.isOpen);
  const openPanel = useChatStore((s) => s.openPanel);

  if (isOpen) return null;

  return (
    <Tooltip label="Open AI Copilot" position="left">
      <ActionIcon
        variant="filled"
        color="var(--color-accent)"
        size="xl"
        radius="xl"
        onClick={openPanel}
        styles={{
          root: {
            position: "fixed",
            bottom: "var(--spacing-lg)",
            right: "var(--spacing-lg)",
            zIndex: Z_INDEX.popover,
            boxShadow: "var(--shadow-lg)",
            transition: "transform var(--transition-normal)",
            "&:hover": {
              transform: "scale(1.05)",
            },
          },
        }}
      >
        <IconSparkles size={22} />
      </ActionIcon>
    </Tooltip>
  );
});
