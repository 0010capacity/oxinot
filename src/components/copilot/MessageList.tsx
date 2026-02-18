import type { ChatMessage, SessionId } from "@/stores/chatStore";
import { useChatStore } from "@/stores/chatStore";
import { Paper, ScrollArea, Text } from "@mantine/core";
import { memo, useEffect, useRef } from "react";

interface MessageListProps {
  sessionId: SessionId;
}

export const MessageList = memo(function MessageList({
  sessionId,
}: MessageListProps) {
  const messages = useChatStore((s) => s.messagesBySession[sessionId] || []);
  const streamingState = useChatStore((s) => s.streamingBySession[sessionId]);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, streamingState?.partialContent]);

  const renderMessage = (message: ChatMessage) => {
    switch (message.role) {
      case "user":
        return (
          <Paper
            key={message.id}
            px="sm"
            py="xs"
            style={{
              alignSelf: "flex-end",
              backgroundColor: "var(--color-accent)",
              color: "white",
              maxWidth: "85%",
              borderRadius:
                "var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)",
            }}
          >
            <Text
              size="sm"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {message.content}
            </Text>
          </Paper>
        );

      case "assistant":
        return (
          <Paper
            key={message.id}
            px="sm"
            py="xs"
            style={{
              alignSelf: "flex-start",
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-text-primary)",
              maxWidth: "85%",
              borderRadius:
                "var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)",
            }}
          >
            <Text
              size="sm"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {message.content}
            </Text>
          </Paper>
        );

      case "tool_trace":
        return (
          <Paper
            key={message.id}
            px="sm"
            py="xs"
            style={{
              alignSelf: "flex-start",
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-secondary)",
              maxWidth: "100%",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <Text size="xs" fw={600} c="var(--color-text-tertiary)" mb={4}>
              Tool Calls
            </Text>
            {message.toolCalls?.map((tc, idx) => (
              <div
                key={idx}
                style={{
                  padding: "var(--spacing-xs) 0",
                  borderBottom:
                    idx < (message.toolCalls?.length || 0) - 1
                      ? "1px solid var(--color-border-secondary)"
                      : "none",
                }}
              >
                <Text size="xs" fw={500}>
                  {tc.toolName}
                </Text>
                <Text size="xs" c="var(--color-text-tertiary)" opacity={0.7}>
                  {tc.result?.success
                    ? "Success"
                    : tc.result?.error || "Pending..."}
                </Text>
              </div>
            ))}
          </Paper>
        );
    }
  };

  return (
    <ScrollArea.Autosize
      mah="100%"
      style={{ flex: 1 }}
      viewportRef={viewportRef}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-sm)",
          padding: "var(--spacing-md)",
        }}
      >
        {messages.map(renderMessage)}

        {streamingState?.status === "running" &&
          streamingState.partialContent && (
            <Paper
              px="sm"
              py="xs"
              style={{
                alignSelf: "flex-start",
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-primary)",
                maxWidth: "85%",
                borderRadius:
                  "var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)",
              }}
            >
              <Text
                size="sm"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {streamingState.partialContent}
              </Text>
            </Paper>
          )}

        {streamingState?.status === "running" &&
          !streamingState.partialContent && (
            <Text
              size="sm"
              c="var(--color-text-tertiary)"
              style={{ alignSelf: "flex-start" }}
            >
              Thinking...
            </Text>
          )}

        {streamingState?.status === "error" && (
          <Paper
            px="sm"
            py="xs"
            style={{
              alignSelf: "flex-start",
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-error)",
              maxWidth: "85%",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Text size="sm" c="var(--color-error)">
              Error: {streamingState.error}
            </Text>
          </Paper>
        )}
      </div>
    </ScrollArea.Autosize>
  );
});
