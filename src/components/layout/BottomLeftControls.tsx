import {
  ActionIcon,
  Badge,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconCommand,
  IconHelp,
  IconHome,
  IconLink,
  IconListCheck,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSnowflake,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnowStore } from "../../stores/snowStore";
import { useTodoStore } from "../../stores/todoStore";

interface BottomLeftControlsProps {
  onHomeClick?: () => void;
  onSettingsClick: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCommandPaletteClick?: () => void;
  onGraphViewClick?: () => void;
  onTodoPanelClick?: () => void;
}

export function BottomLeftControls({
  onHomeClick,
  onSettingsClick,
  onSearchClick,
  onHelpClick,
  onCommandPaletteClick,
  onGraphViewClick,
  onTodoPanelClick,
}: BottomLeftControlsProps) {
  const { t } = useTranslation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";
  const isSnowEnabled = useSnowStore((state) => state.isSnowEnabled);
  const toggleSnow = useSnowStore((state) => state.toggleSnow);
  const todos = useTodoStore((s) => s.todos);
  const fetchTodos = useTodoStore((s) => s.fetchTodos);
  const [todoCount, setTodoCount] = useState(0);

  useEffect(() => {
    fetchTodos({ status: ["todo", "doing"] }).then(() => {
      setTodoCount(useTodoStore.getState().todos.length);
    });
  }, [fetchTodos]);

  useEffect(() => {
    setTodoCount(todos.length);
  }, [todos]);

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

      <Tooltip label="Graph View" position="top">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onGraphViewClick}
          styles={iconButtonStyles}
        >
          <IconLink size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="TODO List" position="top">
        <div style={{ position: "relative" }}>
          <ActionIcon
            variant="subtle"
            size="md"
            onClick={onTodoPanelClick}
            styles={iconButtonStyles}
          >
            <IconListCheck size={16} />
          </ActionIcon>
          {todoCount > 0 && (
            <Badge
              size="xs"
              color="blue"
              variant="filled"
              styles={{
                root: {
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  fontSize: 10,
                  fontWeight: 600,
                },
              }}
            >
              {todoCount > 99 ? "99+" : todoCount}
            </Badge>
          )}
        </div>
      </Tooltip>
    </div>
  );
}
