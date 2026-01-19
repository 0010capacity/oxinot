import { ActionIcon, Button, Group, Stack, Text } from "@mantine/core";
import { IconRotateClockwise } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_SHORTCUTS,
  type Shortcut,
  useShortcutStore,
} from "../../stores/shortcutStore";
import type { ShortcutsSettingsProps } from "./types";

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;

function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.modKey) parts.push(isMac ? "Cmd" : "Ctrl");
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.metaKey) parts.push(isMac ? "Cmd" : "Win");
  if (shortcut.altKey) parts.push(isMac ? "Opt" : "Alt");
  if (shortcut.shiftKey) parts.push("Shift");

  let key = shortcut.key.toUpperCase();
  if (key === " ") key = "Space";
  parts.push(key);

  return parts.join("+");
}

function ShortcutRow({
  label,
  shortcut,
  onUpdate,
  onReset,
}: {
  id: string;
  label: string;
  shortcut: Shortcut;
  onUpdate: (s: Partial<Shortcut>) => void;
  onReset: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore isolated modifier presses
      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;

      const newShortcut: Partial<Shortcut> = {
        key: e.key,
        modKey: false,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      };

      // Intelligent "Mod" key detection for cross-platform portability
      if (isMac && e.metaKey && !e.ctrlKey) {
        newShortcut.modKey = true;
        newShortcut.metaKey = false;
      } else if (!isMac && e.ctrlKey && !e.metaKey) {
        newShortcut.modKey = true;
        newShortcut.ctrlKey = false;
      }

      onUpdate(newShortcut);
      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    // window.addEventListener("mousedown", handleMouseDown); // Optional cancellation

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isRecording, onUpdate]);

  return (
    <Group
      justify="space-between"
      p="xs"
      style={{
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--color-bg-tertiary)",
      }}
    >
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Group gap="xs">
        <Button
          variant={isRecording ? "filled" : "default"}
          color={isRecording ? "red" : "gray"}
          size="xs"
          onClick={() => setIsRecording(!isRecording)}
          styles={{ root: { minWidth: 100 } }}
        >
          {isRecording ? "Recording..." : formatShortcut(shortcut)}
        </Button>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onReset}
          title="Reset to default"
          size="sm"
        >
          <IconRotateClockwise size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

export function ShortcutsSettings({ matchesSearch }: ShortcutsSettingsProps) {
  const { t } = useTranslation();
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcutStore();

  const handleUpdate = (id: string, newShortcut: Partial<Shortcut>) => {
    updateShortcut(id, newShortcut);
  };

  const handleReset = (id: string) => {
    updateShortcut(id, DEFAULT_SHORTCUTS[id]);
  };

  const items = [
    { id: "command_palette", label: t("settings.shortcuts.command_palette") },
    { id: "search", label: t("settings.shortcuts.search") },
    { id: "settings", label: t("common.settings") },
    { id: "help", label: t("settings.shortcuts.help") },
    { id: "toggle_index", label: t("settings.shortcuts.toggle_index") },
    { id: "toggle_copilot", label: t("settings.shortcuts.toggle_copilot") },
  ];

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.shortcuts.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.shortcuts.description")}
        </Text>

        <Stack gap="sm">
          {items
            .filter((item) => matchesSearch(item.label))
            .map((item) => (
              <ShortcutRow
                key={item.id}
                id={item.id}
                label={item.label}
                shortcut={shortcuts[item.id] || DEFAULT_SHORTCUTS[item.id]}
                onUpdate={(s) => handleUpdate(item.id, s)}
                onReset={() => handleReset(item.id)}
              />
            ))}
        </Stack>

        <Group mt="xl">
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={resetShortcuts}
          >
            Reset All Shortcuts
          </Button>
        </Group>
      </div>
    </Stack>
  );
}
