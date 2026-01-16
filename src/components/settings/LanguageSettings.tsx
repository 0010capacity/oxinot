import { Select, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { LanguageSettingsProps } from "./types";

export function LanguageSettings({
  language,
  i18nLanguage,
  setLanguage,
}: LanguageSettingsProps) {
  const { t, i18n } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.tabs.language")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.language.description")}
        </Text>

        <Stack gap="lg">
          <div>
            <Text size="sm" fw={500} mb={8}>
              {t("settings.language.select")}
            </Text>
            <Select
              value={language || i18nLanguage}
              onChange={(value) => {
                const newLang = value || "en";
                setLanguage(newLang);
                i18n.changeLanguage(newLang);
              }}
              data={[
                { label: "English", value: "en" },
                { label: "한국어", value: "ko" },
              ]}
              allowDeselect={false}
            />
          </div>
        </Stack>
      </div>
    </Stack>
  );
}
