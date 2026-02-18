import { useChatStore } from "@/stores/chatStore";
import { ActionIcon, Group, ScrollArea, Tooltip } from "@mantine/core";
import { IconMessagePlus, IconX } from "@tabler/icons-react";
import { memo, useCallback } from "react";

export const PanelHeader = memo(function PanelHeader() {
  const sessions = useChatStore((s) =>
    s.sessionOrder.map((id) => s.sessions[id]).filter(Boolean),
  );
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const createSession = useChatStore((s) => s.createSession);
  const closePanel = useChatStore((s) => s.closePanel);

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleClose = useCallback(() => {
    closePanel();
  }, [closePanel]);

  return (
    <Group
      gap="xs"
      px="sm"
      py="xs"
      style={{
        borderBottom: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-secondary)",
        minHeight: "44px",
      }}
    >
      <Tooltip label="New chat">
        <ActionIcon
          variant="subtle"
          color="var(--color-text-secondary)"
          onClick={handleNewSession}
        >
          <IconMessagePlus size={18} />
        </ActionIcon>
      </Tooltip>

      <ScrollArea type="never" style={{ flex: 1 }}>
        <Group gap={4} wrap="nowrap" style={{ flex: 1 }}>
          {sessions.slice(0, 5).map((session) => (
            <button
              key={session.id}
              onClick={() => switchSession(session.id)}
              style={{
                padding: "4px 10px",
                fontSize: "var(--font-size-xs)",
                borderRadius: "var(--radius-sm)",
                border: "none",
                backgroundColor:
                  session.id === activeSessionId
                    ? "var(--color-interactive-selected)"
                    : "transparent",
                color:
                  session.id === activeSessionId
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100px",
                transition:
                  "background-color var(--transition-fast), color var(--transition-fast)",
              }}
              title={session.title}
            >
              {session.title}
            </button>
          ))}
        </Group>
      </ScrollArea>

      <Tooltip label="Close (Esc)">
        <ActionIcon
          variant="subtle"
          color="var(--color-text-secondary)"
          onClick={handleClose}
        >
          <IconX size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
});
