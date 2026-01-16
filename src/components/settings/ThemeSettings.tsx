import { SegmentedControl, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ColorVariant } from "../../stores/themeStore";
import type { ThemeSettingsProps } from "./types";

export function ThemeSettings({
  matchesSearch,
  colorScheme,
  setColorScheme,
  colorVariant,
  setColorVariant,
}: ThemeSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.theme.title")}
        </Text>

        <Stack gap="lg">
          {matchesSearch(t("settings.theme.color_mode")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.theme.color_mode")}
              </Text>
              <SegmentedControl
                value={colorScheme}
                onChange={(value) => {
                  if (
                    value === "light" ||
                    value === "dark" ||
                    value === "auto"
                  ) {
                    setColorScheme(value);
                  }
                }}
                data={[
                  {
                    label: t("settings.theme.modes.light"),
                    value: "light",
                  },
                  {
                    label: t("settings.theme.modes.dark"),
                    value: "dark",
                  },
                  {
                    label: t("settings.theme.modes.auto"),
                    value: "auto",
                  },
                ]}
                fullWidth
              />
            </div>
          )}

          {matchesSearch(t("settings.theme.color_variant")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.theme.color_variant")}
              </Text>
              <SegmentedControl
                value={colorVariant}
                onChange={(value) => setColorVariant(value as ColorVariant)}
                data={[
                  {
                    label: t("settings.theme.variants.default"),
                    value: "default",
                  },
                  {
                    label: t("settings.theme.variants.blue"),
                    value: "blue",
                  },
                  {
                    label: t("settings.theme.variants.purple"),
                    value: "purple",
                  },
                  {
                    label: t("settings.theme.variants.green"),
                    value: "green",
                  },
                  {
                    label: t("settings.theme.variants.amber"),
                    value: "amber",
                  },
                ]}
                fullWidth
              />
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
