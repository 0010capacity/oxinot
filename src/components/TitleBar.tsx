import { Group, ActionIcon, useMantineColorScheme } from "@mantine/core";
import {
  IconSun,
  IconMoon,
  IconSettings,
  IconMinus,
  IconSquare,
  IconX,
  IconFolderOpen,
  IconSearch,
  IconHelp,
  IconCalendar,
} from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

interface TitleBarProps {
  onSettingsClick: () => void;
  onWorkspaceChange: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCalendarClick?: () => void;
}

export function TitleBar({
  onSettingsClick,
  onWorkspaceChange,
  onSearchClick,
  onHelpClick,
  onCalendarClick,
}: TitleBarProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const appWindow = getCurrentWindow();
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    // Detect OS using navigator.platform or userAgent
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    setIsMacOS(platform.includes("mac") || userAgent.includes("mac"));
  }, []);

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
      data-tauri-drag-region
      style={{
        height: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
        userSelect: "none",
        WebkitUserSelect: "none",
        paddingLeft: isMacOS ? "78px" : "16px", // Space for macOS traffic lights
        paddingRight: "12px",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Left spacer for macOS traffic lights - this area is reserved */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      />

      {/* Control buttons */}
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        <ActionIcon
          variant="subtle"
          size="md"
          title="Change workspace"
          onClick={onWorkspaceChange}
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          <IconFolderOpen size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="md"
          title="Search"
          onClick={onSearchClick}
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          <IconSearch size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="md"
          title="Calendar"
          onClick={onCalendarClick}
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          <IconCalendar size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="md"
          title="Help"
          onClick={onHelpClick}
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          <IconHelp size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          onClick={toggleColorScheme}
          size="md"
          title="Toggle theme"
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="md"
          title="Settings"
          onClick={onSettingsClick}
          styles={{
            root: {
              color: isDark ? "#c1c2c5" : "#495057",
              "&:hover": {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            },
          }}
        >
          <IconSettings size={16} />
        </ActionIcon>

        {/* Window controls - only show on Windows/Linux */}
        {!isMacOS && (
          <div
            style={{
              marginLeft: "8px",
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
                  color: isDark ? "#909296" : "#5c5f66",
                  borderRadius: "0",
                  "&:hover": {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
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
                  color: isDark ? "#909296" : "#5c5f66",
                  borderRadius: "0",
                  "&:hover": {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
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
                  color: isDark ? "#909296" : "#5c5f66",
                  borderRadius: "0",
                  "&:hover": {
                    backgroundColor: "#e81123",
                    color: "#ffffff",
                  },
                },
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </div>
        )}
      </Group>
    </div>
  );
}
