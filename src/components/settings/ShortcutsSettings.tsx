import {
  Badge,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ShortcutsSettingsProps } from "./types";

export function ShortcutsSettings({ matchesSearch }: ShortcutsSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.shortcuts.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.shortcuts.description")}
        </Text>

        <Stack gap="md">
          {matchesSearch("keyboard shortcuts hotkey command") && (
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                backgroundColor: "var(--color-bg-tertiary)",
              }}
            >
              <Group justify="space-between" mb={8}>
                <Text size="sm" fw={500}>
                  {t("settings.shortcuts.command_palette")}
                </Text>
                <Badge variant="light">Cmd+K</Badge>
              </Group>
              <Group justify="space-between" mb={8}>
                <Text size="sm" fw={500}>
                  {t("settings.shortcuts.search")}
                </Text>
                <Badge variant="light">Cmd+P</Badge>
              </Group>
              <Group justify="space-between" mb={8}>
                <Text size="sm" fw={500}>
                  {t("common.settings")}
                </Text>
                <Badge variant="light">Cmd+,</Badge>
              </Group>
              <Group justify="space-between" mb={8}>
                <Text size="sm" fw={500}>
                  {t("settings.shortcuts.help")}
                </Text>
                <Badge variant="light">Cmd+?</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  {t("settings.shortcuts.toggle_index")}
                </Text>
                <Badge variant="light">Cmd+\</Badge>
              </Group>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
