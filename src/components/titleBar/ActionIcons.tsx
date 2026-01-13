import { ActionIcon, Group } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import {
  IconCalendar,
  IconCommand,
  IconHelp,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";

interface ActionIconsProps {
  onSettingsClick: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCalendarClick?: () => void;
  onCommandPaletteClick?: () => void;
}

/**
 * Action icons in the title bar (search, calendar, help, theme, settings).
 * Extracted for better organization and maintainability.
 */
export function ActionIcons({
  onSettingsClick,
  onSearchClick,
  onHelpClick,
  onCalendarClick,
  onCommandPaletteClick,
}: ActionIconsProps) {
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
    <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
      <ActionIcon
        variant="subtle"
        size="md"
        title="Command Palette (Cmd+K)"
        onClick={onCommandPaletteClick}
        styles={iconButtonStyles}
      >
        <IconCommand size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title="Search"
        onClick={onSearchClick}
        styles={iconButtonStyles}
      >
        <IconSearch size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title="Calendar"
        onClick={onCalendarClick}
        styles={iconButtonStyles}
      >
        <IconCalendar size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title="Help"
        onClick={onHelpClick}
        styles={iconButtonStyles}
      >
        <IconHelp size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        onClick={toggleColorScheme}
        size="md"
        title="Toggle theme"
        styles={iconButtonStyles}
      >
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title="Settings"
        onClick={onSettingsClick}
        styles={iconButtonStyles}
      >
        <IconSettings size={16} />
      </ActionIcon>
    </Group>
  );
}
