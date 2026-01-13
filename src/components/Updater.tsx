import {
  Alert,
  Button,
  Group,
  Modal,
  Progress,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconDownload } from "@tabler/icons-react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

export function Updater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [_isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async (silent = true) => {
    try {
      setIsChecking(true);
      setError(null);

      const update = await check();

      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
        setUpdateNotes(update.body || "");
      } else if (!silent) {
        // Only show "no updates" message if user manually checked
        setError("You are already running the latest version.");
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      if (!silent) {
        setError("Failed to check for updates. Please try again later.");
      }
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    try {
      setIsDownloading(true);
      setError(null);

      const update = await check();

      if (!update?.available) {
        setError("No update available.");
        setIsDownloading(false);
        return;
      }

      let contentLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            console.log(`Started downloading ${contentLength} bytes`);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress((downloaded / contentLength) * 100);
            }
            break;
          case "Finished":
            console.log("Download finished");
            setDownloadProgress(100);
            break;
        }
      });

      console.log("Update installed, restarting...");

      // On Windows, the app exits automatically
      // On macOS/Linux, we need to relaunch
      await relaunch();
    } catch (err) {
      console.error("Failed to install update:", err);
      setError("Failed to install update. Please try again.");
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Check for updates on mount (silent check)
  useEffect(() => {
    checkForUpdates(true);
  }, []);

  const handleClose = () => {
    if (!isDownloading) {
      setUpdateAvailable(false);
      setError(null);
    }
  };

  const handleManualCheck = () => {
    checkForUpdates(false);
  };

  return (
    <>
      <Modal
        opened={updateAvailable}
        onClose={handleClose}
        title={
          <Group gap="xs">
            <IconDownload size={20} />
            <Text fw={600}>Update Available</Text>
          </Group>
        }
        closeOnClickOutside={!isDownloading}
        closeOnEscape={!isDownloading}
        withCloseButton={!isDownloading}
      >
        <Stack gap="md">
          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              title="Error"
            >
              {error}
            </Alert>
          )}

          {!error && (
            <>
              <Text size="sm">
                A new version{" "}
                <Text span fw={600}>
                  {updateVersion}
                </Text>{" "}
                is available.
              </Text>

              {updateNotes && (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Release Notes:
                  </Text>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                    {updateNotes}
                  </Text>
                </Stack>
              )}

              {isDownloading && (
                <Stack gap="xs">
                  <Text size="sm">Downloading update...</Text>
                  <Progress value={downloadProgress} animated />
                  <Text size="xs" c="dimmed">
                    {Math.round(downloadProgress)}%
                  </Text>
                </Stack>
              )}

              {!isDownloading && (
                <Group justify="flex-end" mt="md">
                  <Button variant="subtle" onClick={handleClose}>
                    Later
                  </Button>
                  <Button
                    onClick={installUpdate}
                    leftSection={<IconDownload size={16} />}
                  >
                    Download and Install
                  </Button>
                </Group>
              )}

              {isDownloading && (
                <Text size="xs" c="dimmed" ta="center">
                  Please don't close the application during the update.
                </Text>
              )}
            </>
          )}
        </Stack>
      </Modal>

      {/* Hidden manual check trigger - can be called from settings or help menu */}
      <div
        style={{ display: "none" }}
        data-updater-manual-check
        onClick={handleManualCheck}
      />
    </>
  );
}

export { Updater as default };
