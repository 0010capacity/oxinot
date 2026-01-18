import { Select, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { HomepageSettingsProps } from "./types";

export function HomepageSettings({
  matchesSearch,
  homepageType,
  setHomepageType,
  customHomepageId,
  setCustomHomepageId,
  pagesById,
  pageIds,
}: HomepageSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.homepage.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.homepage.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch("Homepage Type start default") && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.homepage.type")}
              </Text>
              <Select
                value={homepageType}
                onChange={(value) => {
                  if (value)
                    setHomepageType(
                      value as "daily-note" | "index" | "custom-page",
                    );
                }}
                data={[
                  {
                    label: t("settings.homepage.types.daily_note"),
                    value: "daily-note",
                  },
                  {
                    label: t("settings.homepage.types.index"),
                    value: "index",
                  },
                  {
                    label: t("settings.homepage.types.custom_page"),
                    value: "custom-page",
                  },
                ]}
                placeholder={t("settings.homepage.type_placeholder")}
              />
              <Text size="xs" c="dimmed" mt={4}>
                {t("settings.homepage.type_desc")}
              </Text>
            </div>
          )}

          {homepageType === "custom-page" && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.homepage.custom_page")}
              </Text>
              <Select
                value={customHomepageId || ""}
                onChange={(value) => setCustomHomepageId(value || null)}
                data={pageIds.map((id) => ({
                  label: pagesById[id]?.title || id,
                  value: id,
                }))}
                placeholder={t("settings.homepage.custom_page_placeholder")}
                searchable
              />
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
