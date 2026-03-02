import {
  ActionIcon,

  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconCalendar,
  IconCommand,
  IconHelp,
  IconHome,
  IconMoon,
  IconPencil,
  IconSearch,
  IconSettings,
  IconSnowflake,
  IconSun,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSnowStore } from "../../stores/snowStore";
import { useViewStore } from "../../stores/viewStore";

interface BottomLeftControlsProps {
  onHomeClick?: () => void;
  onSettingsClick: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCommandPaletteClick?: () => void;
  onDailyNoteClick?: () => void;
}

export function BottomLeftControls({
  onHomeClick,
  onSettingsClick,
  onSearchClick,
  onHelpClick,
  onCommandPaletteClick,
  onDailyNoteClick,
}: BottomLeftControlsProps) {
  const { t } = useTranslation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";
  const isSnowEnabled = useSnowStore((state) => state.isSnowEnabled);
  const toggleSnow = useSnowStore((state) => state.toggleSnow);
  const writingMode = useViewStore((state) => state.writingMode);
  const toggleWritingMode = useViewStore((state) => state.toggleWritingMode);
  const viewMode = useViewStore((state) => state.mode);

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
        flexDirection: "column",
        gap: "4px",
        alignItems: "center",
      }}
    >
      <Tooltip
        label={
          viewMode === "note"
            ? t("navigation.writing_mode_toggle")
            : t("navigation.writing_mode_disabled")
        }
        position="top"
      >
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={toggleWritingMode}
          disabled={viewMode !== "note"}
          styles={{
            root: {
              color: writingMode && viewMode === "note"
                ? "var(--color-interactive-hover)"
                : "var(--color-text-secondary)",
              "&:hover": {
                backgroundColor: "var(--color-interactive-hover)",
              },
            },
          }}
        >
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip
        label={isSnowEnabled ? "Disable snowfall" : "Enable snowfall"}
        position="top"
      >
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={toggleSnow}
          styles={{
            root: {
              color: isSnowEnabled
                ? "var(--color-interactive-hover)"
                : "var(--color-text-secondary)",
              "&:hover": {
                backgroundColor: "var(--color-interactive-hover)",
              },
            },
          }}
        >
          <IconSnowflake size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("common.home")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onHomeClick}
          styles={iconButtonStyles}
        >
          <IconHome size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("navigation.daily_note")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onDailyNoteClick}
          styles={iconButtonStyles}
        >
          <IconCalendar size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("navigation.daily_note")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onDailyNoteClick}
          styles={iconButtonStyles}
        >
          <IconCalendar size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("common.settings")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onSettingsClick}
          styles={iconButtonStyles}
        >
          <IconSettings size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("common.help")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onHelpClick}
          styles={iconButtonStyles}
        >
          <IconHelp size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("navigation.toggle_theme")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={toggleColorScheme}
          styles={iconButtonStyles}
        >
          {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("common.search")} position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onSearchClick}
          styles={iconButtonStyles}
        >
          <IconSearch size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("navigation.command_palette")} position="top">
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
