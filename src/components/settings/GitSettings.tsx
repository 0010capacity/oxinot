import {
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { IconBrandGit, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { GitSettingsProps } from "./types";

export function GitSettings({
  matchesSearch,
  isGitRepo,
  hasGitChanges,
  autoCommitEnabled,
  setAutoCommitEnabled,
  autoCommitInterval,
  setAutoCommitInterval,
  checkGitStatus,
  gitCommit,
  initGit,
  remoteUrl,
  getRemoteUrl,
  removeRemote,
  workspacePath,
}: GitSettingsProps) {
  const { t } = useTranslation();
  const isDark = useComputedColorScheme("light") === "dark";

  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;
    const timestamp = new Date().toISOString();
    try {
      await gitCommit(workspacePath, `Auto-save: ${timestamp}`);
    } catch (error) {
      console.error("Commit failed:", error);
    }
  };

  const handleRemoveRemote = async () => {
    if (!workspacePath) return;
    if (window.confirm(t("settings.git.remove_remote_confirm"))) {
      try {
        await removeRemote(workspacePath);
      } catch (error) {
        console.error("Failed to remove remote:", error);
      }
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.git.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.git.description")}
        </Text>

        <Stack gap="lg">
          {!isGitRepo ? (
            matchesSearch("initialize git repository") && (
              <>
                <Button
                  leftSection={<IconBrandGit size={16} />}
                  onClick={() => {
                    if (workspacePath) initGit(workspacePath);
                  }}
                  variant="filled"
                  color="blue"
                >
                  {t("settings.git.init_button")}
                </Button>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                  }}
                >
                  <Text size="sm" fw={500} mb={8}>
                    {t("settings.git.why_git")}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t("settings.git.why_git_desc")}
                  </Text>
                </div>
              </>
            )
          ) : (
            <>
              {matchesSearch("repository location path") && (
                <div>
                  <Text size="sm" fw={500} mb={8}>
                    {t("settings.git.repo_location")}
                  </Text>
                  <Text
                    size="sm"
                    c="dimmed"
                    style={{
                      fontFamily: "monospace",
                      backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      wordBreak: "break-all",
                    }}
                  >
                    {workspacePath}
                  </Text>
                </div>
              )}

              {matchesSearch("current status commit changes") && (
                <div>
                  <Text size="sm" fw={500} mb={8}>
                    {t("settings.git.current_status")}
                  </Text>
                  <Group gap="xs" mb={8}>
                    <Button
                      size="sm"
                      variant="light"
                      color={hasGitChanges ? "yellow" : "gray"}
                      onClick={handleGitCommit}
                      disabled={!hasGitChanges}
                    >
                      {hasGitChanges
                        ? t("settings.git.commit_changes")
                        : t("settings.git.no_changes")}
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        if (workspacePath) checkGitStatus(workspacePath);
                      }}
                    >
                      {t("settings.git.refresh")}
                    </Button>
                  </Group>
                  <Text size="xs" c={hasGitChanges ? "yellow" : "dimmed"}>
                    {hasGitChanges
                      ? t("settings.git.uncommitted_changes")
                      : t("settings.git.all_committed")}
                  </Text>
                </div>
              )}

              {matchesSearch("auto commit interval") && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                    borderLeft: `3px solid ${isDark ? "#4C6EF5" : "#5C7CFA"}`,
                  }}
                >
                  <Text size="sm" fw={500} mb={8}>
                    {t("settings.git.auto_commit")}
                  </Text>
                  <Switch
                    label={t("settings.git.enable_auto_commit")}
                    description={t("settings.git.enable_auto_commit_desc")}
                    checked={autoCommitEnabled}
                    onChange={(event) =>
                      setAutoCommitEnabled(event.currentTarget.checked)
                    }
                    mb={autoCommitEnabled ? 12 : 0}
                  />

                  {autoCommitEnabled && (
                    <>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.git.commit_interval")}
                      </Text>
                      <NumberInput
                        value={autoCommitInterval}
                        onChange={(value) =>
                          setAutoCommitInterval(
                            typeof value === "number" ? value : 5
                          )
                        }
                        min={1}
                        max={60}
                        step={1}
                        suffix=" min"
                      />
                      <Text size="xs" c="dimmed" mt={8}>
                        {t("settings.git.commit_interval_desc", {
                          interval: autoCommitInterval,
                        })}
                      </Text>
                    </>
                  )}
                </div>
              )}

              {matchesSearch("remote repository url push pull") && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                    borderLeft: `3px solid ${isDark ? "#4C6EF5" : "#5C7CFA"}`,
                  }}
                >
                  <Text size="sm" fw={500} mb={8}>
                    {t("settings.git.remote_repo")}
                  </Text>
                  {remoteUrl ? (
                    <Stack gap="xs">
                      <Group gap="xs" align="flex-start">
                        <Text
                          size="sm"
                          c="dimmed"
                          style={{
                            fontFamily: "monospace",
                            flex: 1,
                            wordBreak: "break-all",
                          }}
                        >
                          {remoteUrl}
                        </Text>
                        <Tooltip label={t("tooltips.remove_remote")}>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={handleRemoveRemote}
                          >
                            <IconX size={14} />
                          </Button>
                        </Tooltip>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {t("settings.git.push_pull_hint")}
                      </Text>
                    </Stack>
                  ) : (
                    <Button
                      size="sm"
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={() => {
                        if (workspacePath) getRemoteUrl(workspacePath);
                      }}
                    >
                      {t("settings.git.add_remote")}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
