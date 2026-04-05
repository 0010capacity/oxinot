import {
  ActionIcon,
  Box,
  Group,
  MantineProvider,
  Paper,
  Text,
  Textarea,
  createTheme,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { IconX, IconCheck } from "@tabler/icons-react";

const theme = createTheme({
  primaryColor: "blue",
});

function QuickNoteApp() {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = async () => {
    await invoke("hide_quick_note_window");
  };

  const handleSave = async () => {
    if (!content.trim()) {
      await handleClose();
      return;
    }

    setIsSaving(true);
    try {
      // Save to Inbox.md file
      await invoke("append_to_inbox", { content: content.trim() });
      setContent("");
      await handleClose();
    } catch (error) {
      console.error("Failed to save quick note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Box
        style={{
          width: "100%",
          height: "100%",
          padding: "12px",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Paper
          shadow="md"
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Group
            justify="space-between"
            p="xs"
            style={{
              borderBottom: "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <Text size="sm" fw={500}>
              Quick Note
            </Text>
            <ActionIcon variant="subtle" color="gray" onClick={handleClose}>
              <IconX size={16} />
            </ActionIcon>
          </Group>

          <Textarea
            placeholder="Type your note... (Cmd+Enter to save, Esc to close)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autosize
            style={{
              flex: 1,
              padding: "8px 12px",
            }}
            styles={{
              input: {
                height: "100% !important",
                border: "none",
                resize: "none",
                "&:focus": {
                  outline: "none",
                  borderColor: "transparent",
                },
              },
            }}
          />

          <Group
            justify="flex-end"
            p="xs"
            style={{
              borderTop: "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <ActionIcon
              variant="filled"
              color="blue"
              onClick={handleSave}
              loading={isSaving}
              disabled={!content.trim()}
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      </Box>
    </MantineProvider>
  );
}

export default QuickNoteApp;
