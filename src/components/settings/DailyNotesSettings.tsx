import { Button, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { DailyNotesSettingsProps } from "./types";

export function DailyNotesSettings({
  matchesSearch,
  dailyNotesPath,
  setDailyNotesPath,
  dailyNoteTemplateId,
  setDailyNoteTemplateId,
  pagesById,
  pageIds,
}: DailyNotesSettingsProps) {
  const { t } = useTranslation();

  // Create page options for select
  const pageOptions = pageIds
    .map((id) => {
      const page = pagesById[id];
      if (!page) return null;

      // Build the full path of the page
      const buildPath = (pageId: string): string => {
        const p = pagesById[pageId];
        if (!p) return "";
        if (p.parentId) {
          const parentPath = buildPath(p.parentId);
          return parentPath ? `${parentPath}/${p.title}` : p.title;
        }
        return p.title;
      };

      const fullPath = buildPath(id);
      return { value: id, label: fullPath };
    })
    .filter((opt) => opt !== null);

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

          {matchesSearch("template") && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.daily_notes.template")}
              </Text>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <Select
                    placeholder={t("settings.daily_notes.template_placeholder")}
                    data={pageOptions}
                    value={dailyNoteTemplateId}
                    onChange={(value) =>
                      setDailyNoteTemplateId(value ? value : null)
                    }
                    searchable
                    clearable
                  />
                </div>
                {dailyNoteTemplateId && (
                  <Button
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setDailyNoteTemplateId(null)}
                    title={t("common.clear")}
                  >
                    <IconX size={16} />
                  </Button>
                )}
              </div>
              <Text size="xs" c="dimmed" mt={8}>
                {t("settings.daily_notes.template_desc")}
              </Text>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
