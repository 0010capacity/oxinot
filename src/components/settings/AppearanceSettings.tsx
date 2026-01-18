import { Group, Select, Slider, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { FontFamily } from "../../stores/themeStore";
import type { AppearanceSettingsProps } from "./types";

export function AppearanceSettings({
  matchesSearch,
  fontFamily,
  setFontFamily,
  getFontStack,
  editorFontSize,
  setEditorFontSize,
  editorLineHeight,
  setEditorLineHeight,
  fontOptions,
}: AppearanceSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.appearance.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.appearance.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch(t("settings.appearance.font_family")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.appearance.font_family")}
              </Text>
              <Select
                value={fontFamily}
                onChange={(value) => {
                  if (value) setFontFamily(value as FontFamily);
                }}
                data={fontOptions}
                placeholder={t("settings.appearance.font_family")}
                searchable
              />
              <Text size="xs" c="dimmed" mt={4}>
                {t("settings.appearance.font_family_desc")}
              </Text>
              <div
                style={{
                  marginTop: 12,
                  padding: 16,
                  borderRadius: 6,
                  backgroundColor: "var(--color-bg-tertiary)",
                  fontFamily: getFontStack(),
                }}
              >
                <Text size="sm" style={{ fontFamily: getFontStack() }}>
                  The quick brown fox jumps over the lazy dog
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                  style={{ fontFamily: getFontStack() }}
                >
                  0123456789 !@#$%^&*()
                </Text>
              </div>
            </div>
          )}

          {matchesSearch(t("settings.appearance.editor_font_size")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.appearance.editor_font_size")}
              </Text>
              <Group gap="md" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Slider
                    value={editorFontSize}
                    onChange={setEditorFontSize}
                    min={12}
                    max={24}
                    step={1}
                    marks={[
                      { value: 12, label: "12" },
                      { value: 16, label: "16" },
                      { value: 20, label: "20" },
                      { value: 24, label: "24" },
                    ]}
                  />
                </div>
                <Text
                  size="sm"
                  fw={500}
                  style={{ minWidth: 50, textAlign: "right", marginTop: 8 }}
                >
                  {editorFontSize}px
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt={12}>
                {t("settings.appearance.editor_font_size_desc")}
              </Text>
            </div>
          )}

          {matchesSearch(t("settings.appearance.editor_line_height")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.appearance.editor_line_height")}
              </Text>
              <Group gap="md" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Slider
                    value={editorLineHeight}
                    onChange={setEditorLineHeight}
                    min={1.2}
                    max={2.0}
                    step={0.1}
                    marks={[
                      { value: 1.2, label: "1.2" },
                      { value: 1.6, label: "1.6" },
                      { value: 2.0, label: "2.0" },
                    ]}
                  />
                </div>
                <Text
                  size="sm"
                  fw={500}
                  style={{ minWidth: 50, textAlign: "right", marginTop: 8 }}
                >
                  {editorLineHeight.toFixed(1)}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt={12}>
                {t("settings.appearance.editor_line_height_desc")}
              </Text>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
