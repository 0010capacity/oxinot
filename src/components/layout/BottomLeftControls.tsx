import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconSun,
  IconMoon,
  IconSettings,
  IconSearch,
  IconHelp,
  IconCommand,
  IconHome,
} from "@tabler/icons-react";
import { useMantineColorScheme } from "@mantine/core";

interface BottomLeftControlsProps {
  onHomeClick?: () => void;
  onSettingsClick: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCommandPaletteClick?: () => void;
}

/**
 * Bottom-left control buttons (home, settings, help, theme, search, command palette).
 * Positioned at the bottom-left of the screen for easy access.
 */
export function BottomLeftControls({
  onHomeClick,
  onSettingsClick,
  onSearchClick,
  onHelpClick,
  onCommandPaletteClick,
}: BottomLeftControlsProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const iconButtonStyles = {
    root: {
      color: "var(--color-text-secondary)",
      "&:hover": {
        backgroundColor: "var(--color-interactive-hover)",
      },
    },
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "8px",
        left: "8px",
        zIndex: 40,
        display: "flex",
        gap: "4px",
        alignItems: "center",
      }}
    >
      <Tooltip label="Home" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onHomeClick}
          styles={iconButtonStyles}
        >
          <IconHome size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Settings" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onSettingsClick}
          styles={iconButtonStyles}
        >
          <IconSettings size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Help" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onHelpClick}
          styles={iconButtonStyles}
        >
          <IconHelp size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Toggle theme" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={toggleColorScheme}
          styles={iconButtonStyles}
        >
          {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Search" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onSearchClick}
          styles={iconButtonStyles}
        >
          <IconSearch size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Command Palette (Cmd+K)" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onCommandPaletteClick}
          styles={iconButtonStyles}
        >
          <IconCommand size={16} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
