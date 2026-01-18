import { Badge, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useUpdaterStore } from "../../stores/updaterStore";
import type { AboutSettingsProps } from "./types";

export function AboutSettings({ appVersion }: AboutSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.about.title")}
        </Text>

        <Stack gap="lg">
          <div>
            <Group gap="xs" mb={8}>
              <Text size="lg" fw={600}>
                {t("settings.about.app_name")}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t("settings.about.version", {
                version: appVersion || "Loading...",
              })}
            </Text>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 8,
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-primary)",
            }}
          >
            <Group justify="space-between" mb={8} align="flex-start">
              <Text size="sm" fw={600}>
                {t("settings.about.updates_title")}
              </Text>
              {useUpdaterStore.getState().status === "checking" && (
                <Badge color="blue" variant="light">
                  {t("settings.about.checking_status")}
                </Badge>
              )}
              {useUpdaterStore.getState().status === "available" && (
                <Badge color="green" variant="light">
                  {t("settings.about.update_available")}
                </Badge>
              )}
              {useUpdaterStore.getState().status === "uptodate" && (
                <Badge color="gray" variant="light">
                  {t("settings.about.latest_version")}
                </Badge>
              )}
            </Group>

            {(() => {
              const status = useUpdaterStore((state) => state.status);
              const version = useUpdaterStore((state) => state.version);
              const body = useUpdaterStore((state) => state.body);
              const error = useUpdaterStore((state) => state.error);
              const progress = useUpdaterStore((state) => state.progress);
              const checkForUpdates = useUpdaterStore(
                (state) => state.checkForUpdates,
              );
              const installUpdate = useUpdaterStore(
                (state) => state.installUpdate,
              );

              if (status === "checking") {
                return (
                  <Text size="sm" c="dimmed">
                    {t("settings.about.checking_for_updates")}
                  </Text>
                );
              }

              if (status === "uptodate") {
                return (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t("settings.about.up_to_date")}
                    </Text>
                    <Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => checkForUpdates(false)}
                        leftSection={<IconDownload size={16} />}
                      >
                        {t("settings.about.check_again")}
                      </Button>
                    </Group>
                  </Stack>
                );
              }

              if (status === "available") {
                return (
                  <Stack gap="md">
                    <Text size="sm">
                      {t("settings.about.new_version_available", {
                        version: version,
                      })}
                    </Text>
                    {body && (
                      <div
                        style={{
                          maxHeight: 150,
                          overflowY: "auto",
                          padding: 8,
                          backgroundColor: "var(--color-bg-elevated)",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                          {body}
                        </Text>
                      </div>
                    )}
                    <Group>
                      <Button
                        size="xs"
                        onClick={installUpdate}
                        leftSection={<IconDownload size={16} />}
                      >
                        {t("settings.about.update_now")}
                      </Button>
                    </Group>
                  </Stack>
                );
              }

              if (status === "downloading") {
                return (
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm">
                        {t("settings.about.downloading_update")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {Math.round(progress)}%
                      </Text>
                    </Group>
                    <Progress value={progress} animated size="sm" />
                  </Stack>
                );
              }

              if (status === "downloaded") {
                return (
                  <Stack gap="xs">
                    <Text size="sm" c="green">
                      {t("settings.about.download_success")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("settings.about.auto_restart")}
                    </Text>
                  </Stack>
                );
              }

              if (status === "error") {
                return (
                  <Stack gap="xs">
                    <Text size="sm" c="red">
                      {t("settings.about.update_error")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {error}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={() => checkForUpdates(false)}
                    >
                      {t("settings.about.check_again")}
                    </Button>
                  </Stack>
                );
              }

              return (
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    {t("settings.about.updates_desc")}
                  </Text>
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => checkForUpdates(false)}
                      leftSection={<IconDownload size={16} />}
                    >
                      {t("settings.about.check_updates_btn")}
                    </Button>
                  </Group>
                </Stack>
              );
            })()}
          </div>
        </Stack>
      </div>
    </Stack>
  );
}
