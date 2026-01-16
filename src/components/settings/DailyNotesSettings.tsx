import { Stack, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { DailyNotesSettingsProps } from "./types";

export function DailyNotesSettings({
  matchesSearch,
  dailyNotesPath,
  setDailyNotesPath,
}: DailyNotesSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.daily_notes.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.daily_notes.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch("Daily Notes Path folder") && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.daily_notes.path")}
              </Text>
              <TextInput
                value={dailyNotesPath}
                onChange={(event) =>
                  setDailyNotesPath(event.currentTarget.value)
                }
                placeholder={t("settings.daily_notes.path_placeholder")}
                description={t("settings.daily_notes.path_desc")}
              />
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
