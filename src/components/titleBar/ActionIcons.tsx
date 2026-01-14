import { ActionIcon, Group, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import {
  IconCalendar,
  IconCommand,
  IconHelp,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

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
        title={t("navigation.command_palette")}
        onClick={onCommandPaletteClick}
        styles={iconButtonStyles}
      >
        <IconCommand size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title={t("common.search")}
        onClick={onSearchClick}
        styles={iconButtonStyles}
      >
        <IconSearch size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title={t("navigation.calendar")}
        onClick={onCalendarClick}
        styles={iconButtonStyles}
      >
        <IconCalendar size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title={t("common.help")}
        onClick={onHelpClick}
        styles={iconButtonStyles}
      >
        <IconHelp size={16} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        onClick={toggleColorScheme}
        size="md"
        title={t("navigation.toggle_theme")}
        styles={iconButtonStyles}
      >
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        size="md"
        title={t("common.settings")}
        onClick={onSettingsClick}
        styles={iconButtonStyles}
      >
        <IconSettings size={16} />
      </ActionIcon>
    </Group>
  );
}
