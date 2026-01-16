import {
  Button,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { AdvancedSettingsProps } from "./types";

export function AdvancedSettings({
  matchesSearch,
  telemetryEnabled,
  setTelemetryEnabled,
  resetAllSettings,
  clearCache,
  vacuumDatabase,
  optimizeDatabase,
}: AdvancedSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.advanced.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.advanced.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch("cache clear") && (
            <div>
              <Text size="sm" fw={500} mb={12}>
                {t("settings.advanced.cache")}
              </Text>
              <Button
                size="sm"
                variant="light"
                onClick={() => {
                  if (
                    window.confirm(t("settings.advanced.clear_cache_confirm"))
                  ) {
                    clearCache();
                  }
                }}
              >
                {t("settings.advanced.clear_cache")}
              </Button>
            </div>
          )}

          {matchesSearch("database maintenance vacuum optimize") && (
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                backgroundColor: "var(--color-bg-tertiary)",
                borderLeft: "3px solid var(--color-accent)",
              }}
            >
              <Text size="sm" fw={500} mb={12}>
                {t("settings.advanced.database_maintenance")}
              </Text>
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("settings.advanced.vacuum_db_title")}
                  </Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    {t("settings.advanced.vacuum_db_desc")}
                  </Text>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={() => {
                      if (
                        window.confirm(t("settings.advanced.vacuum_db_confirm"))
                      ) {
                        vacuumDatabase();
                      }
                    }}
                  >
                    {t("settings.advanced.vacuum_db")}
                  </Button>
                </div>
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("settings.advanced.optimize_db_title")}
                  </Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    {t("settings.advanced.optimize_db_desc")}
                  </Text>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={() => {
                      if (
                        window.confirm(
                          t("settings.advanced.optimize_db_confirm")
                        )
                      ) {
                        optimizeDatabase();
                      }
                    }}
                  >
                    {t("settings.advanced.optimize_db")}
                  </Button>
                </div>
              </Stack>
            </div>
          )}

          {matchesSearch("developer telemetry anonymous") && (
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                backgroundColor: "var(--color-bg-tertiary)",
                borderLeft: "3px solid var(--color-accent)",
              }}
            >
              <Text size="sm" fw={500} mb={12}>
                {t("settings.advanced.developer_options")}
              </Text>
              <Stack gap="md">
                <Switch
                  label={t("settings.advanced.telemetry")}
                  description={t("settings.advanced.telemetry_desc")}
                  checked={telemetryEnabled}
                  onChange={(event) =>
                    setTelemetryEnabled(event.currentTarget.checked)
                  }
                />
              </Stack>
            </div>
          )}

          {matchesSearch("reset settings danger") && (
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                backgroundColor: "var(--color-bg-tertiary)",
                borderLeft: "3px solid var(--color-error)",
              }}
            >
              <Text size="sm" fw={500} mb={12} c="red">
                {t("settings.advanced.danger_zone")}
              </Text>
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("settings.advanced.reset_settings")}
                  </Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    {t("settings.advanced.reset_settings_desc")}
                  </Text>
                  <Button
                    size="sm"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => {
                      if (
                        window.confirm(t("settings.advanced.reset_confirm"))
                      ) {
                        resetAllSettings();
                      }
                    }}
                  >
                    {t("settings.advanced.reset_settings")}
                  </Button>
                </div>
              </Stack>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
