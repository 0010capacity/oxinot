import { NumberInput, Stack, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useOutlinerSettingsStore } from "../../stores/outlinerSettingsStore";
import type { OutlinerSettingsProps } from "./types";

export function OutlinerSettings({
  matchesSearch,
  showIndentGuides,
  toggleIndentGuides,
  autoExpandBlocks,
  setAutoExpandBlocks,
  showBlockCount,
  setShowBlockCount,
  showCodeBlockLineNumbers,
  setShowCodeBlockLineNumbers,
  indentSize,
  setIndentSize,
}: OutlinerSettingsProps) {
  const { t } = useTranslation();
  const enableCodeSyntaxHighlighting = useOutlinerSettingsStore(
    (state) => state.enableCodeSyntaxHighlighting,
  );
  const setEnableCodeSyntaxHighlighting = useOutlinerSettingsStore(
    (state) => state.setEnableCodeSyntaxHighlighting,
  );

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.outliner.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.outliner.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch("indent guides") && (
            <Switch
              label={t("settings.outliner.indent_guides")}
              description={t("settings.outliner.indent_guides_desc")}
              checked={showIndentGuides}
              onChange={toggleIndentGuides}
            />
          )}

          {matchesSearch("auto expand blocks") && (
            <Switch
              label={t("settings.outliner.auto_expand")}
              description={t("settings.outliner.auto_expand_desc")}
              checked={autoExpandBlocks}
              onChange={(event) =>
                setAutoExpandBlocks?.(event.currentTarget.checked)
              }
            />
          )}

          {matchesSearch("block count") && (
            <Switch
              label={t("settings.outliner.block_count")}
              description={t("settings.outliner.block_count_desc")}
              checked={showBlockCount}
              onChange={(event) =>
                setShowBlockCount?.(event.currentTarget.checked)
              }
            />
          )}

          {matchesSearch("code block line numbers") && (
            <Switch
              label={t("settings.outliner.code_block_line_numbers")}
              description={t("settings.outliner.code_block_line_numbers_desc")}
              checked={showCodeBlockLineNumbers}
              onChange={(event) =>
                setShowCodeBlockLineNumbers?.(event.currentTarget.checked)
              }
            />
          )}

          {matchesSearch("syntax highlighting code") && (
            <Switch
              label={t("settings.outliner.code_syntax_highlighting")}
              description={t("settings.outliner.code_syntax_highlighting_desc")}
              checked={enableCodeSyntaxHighlighting}
              onChange={(event) =>
                setEnableCodeSyntaxHighlighting(event.currentTarget.checked)
              }
            />
          )}

          {matchesSearch("indent size") && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.outliner.indent_size")}
              </Text>
              <NumberInput
                value={indentSize}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setIndentSize(value);
                  }
                }}
                min={12}
                max={48}
                step={2}
              />
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
