import { ActionIcon } from "@mantine/core";
import { IconMinus, IconSquare, IconX } from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowControlsProps {
  show?: boolean;
}

/**
 * Window control buttons (minimize, maximize, close) for non-macOS platforms.
 * macOS uses native traffic lights, so these are hidden on macOS.
 */
export function WindowControls({ show = true }: WindowControlsProps) {
  const appWindow = getCurrentWindow();

  if (!show) {
    return null;
  }

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div
      style={{
        marginLeft: "var(--spacing-sm)",
        display: "flex",
        gap: "2px",
      }}
    >
      <ActionIcon
        variant="subtle"
        size="md"
        onClick={handleMinimize}
        title="Minimize"
        styles={{
          root: {
            color: "var(--color-text-tertiary)",
            borderRadius: "0",
            "&:hover": {
              backgroundColor: "var(--color-interactive-hover)",
            },
          },
        }}
      >
        <IconMinus size={14} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="md"
        onClick={handleMaximize}
        title="Maximize"
        styles={{
          root: {
            color: "var(--color-text-tertiary)",
            borderRadius: "0",
            "&:hover": {
              backgroundColor: "var(--color-interactive-hover)",
            },
          },
        }}
      >
        <IconSquare size={13} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="md"
        onClick={handleClose}
        title="Close"
        styles={{
          root: {
            color: "var(--color-text-tertiary)",
            borderRadius: "0",
            "&:hover": {
              backgroundColor: "var(--color-error)",
              color: "#ffffff",
            },
          },
        }}
      >
        <IconX size={16} />
      </ActionIcon>
    </div>
  );
}
