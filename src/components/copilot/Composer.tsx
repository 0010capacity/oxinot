import { chatService } from "@/services/ai/chatService";
import type { SessionId } from "@/stores/chatStore";
import { useChatStore } from "@/stores/chatStore";
import { ActionIcon, Group, Textarea, Tooltip } from "@mantine/core";
import { IconLoader2, IconSend } from "@tabler/icons-react";
import { memo, useCallback, useState } from "react";

interface ComposerProps {
  sessionId: SessionId;
}

export const Composer = memo(function Composer({ sessionId }: ComposerProps) {
  const [input, setInput] = useState("");
  const streamingState = useChatStore((s) => s.streamingBySession[sessionId]);

  const isStreaming = streamingState?.status === "running";

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    chatService.sendMessage(sessionId, trimmed);
  }, [input, isStreaming, sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSend = input.trim().length > 0 && !isStreaming;

  return (
    <Group
      gap="xs"
      p="sm"
      style={{
        borderTop: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-secondary)",
      }}
    >
      <Textarea
        placeholder="Type a message... (Cmd+Enter to send)"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        autosize
        minRows={1}
        maxRows={4}
        style={{ flex: 1 }}
        styles={{
          input: {
            backgroundColor: "var(--color-bg-primary)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-primary)",
            fontSize: "var(--font-size-sm)",
            lineHeight: "var(--line-height-normal)",
            resize: "none",
            "&:focus": {
              borderColor: "var(--color-accent)",
            },
          },
        }}
      />
      <Tooltip label={isStreaming ? "Processing..." : "Send (Cmd+Enter)"}>
        <ActionIcon
          variant="filled"
          color={canSend ? "var(--color-accent)" : "var(--color-bg-tertiary)"}
          size="lg"
          onClick={handleSubmit}
          disabled={!canSend}
          styles={{
            root: {
              "&:disabled": {
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-tertiary)",
              },
            },
          }}
        >
          {isStreaming ? (
            <IconLoader2
              size={18}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <IconSend size={18} />
          )}
        </ActionIcon>
      </Tooltip>
    </Group>
  );
});
