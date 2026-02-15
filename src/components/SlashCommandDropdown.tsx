import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconCode,
  IconHeading,
  IconList,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  trigger: string;
  action: () => void;
}

interface Props {
  query: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

const ICON_SIZE = 16;

export function SlashCommandDropdown({
  query,
  position,
  onSelect,
  onClose,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: SlashCommand[] = useMemo(
    () => [
      {
        id: "ai",
        label: "AI Assistant",
        description: "Ask AI to help with this content",
        icon: (
          <IconSparkles
            size={ICON_SIZE}
            style={{ color: "var(--color-accent)" }}
          />
        ),
        trigger: "ai",
        action: () =>
          onSelect({
            id: "ai",
            label: "AI Assistant",
            description: "Ask AI to help with this content",
            icon: <IconSparkles size={ICON_SIZE} />,
            trigger: "ai",
            action: () => {},
          }),
      },
      {
        id: "code",
        label: "Code Block",
        description: "Create a code block",
        icon: <IconCode size={ICON_SIZE} />,
        trigger: "code",
        action: () =>
          onSelect({
            id: "code",
            label: "Code Block",
            description: "Create a code block",
            icon: <IconCode size={ICON_SIZE} />,
            trigger: "code",
            action: () => {},
          }),
      },
      {
        id: "bullet",
        label: "Bullet List",
        description: "Create a bullet list",
        icon: <IconList size={ICON_SIZE} />,
        trigger: "bullet",
        action: () =>
          onSelect({
            id: "bullet",
            label: "Bullet List",
            description: "Create a bullet list",
            icon: <IconList size={ICON_SIZE} />,
            trigger: "bullet",
            action: () => {},
          }),
      },
      {
        id: "heading",
        label: "Heading",
        description: "Create a heading block",
        icon: <IconHeading size={ICON_SIZE} />,
        trigger: "heading",
        action: () =>
          onSelect({
            id: "heading",
            label: "Heading",
            description: "Create a heading block",
            icon: <IconHeading size={ICON_SIZE} />,
            trigger: "heading",
            action: () => {},
          }),
      },
    ],
    [onSelect],
  );

  const filteredCommands = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.trigger.toLowerCase().startsWith(lowerQuery) ||
        cmd.label.toLowerCase().includes(lowerQuery),
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredCommands.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, filteredCommands, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".slash-command-dropdown")) {
        onClose();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <Paper
      shadow="md"
      p="xs"
      className="slash-command-dropdown"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1000,
        maxWidth: 320,
        width: "100%",
        maxHeight: 300,
        overflowY: "auto",
        backgroundColor: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-secondary)",
      }}
    >
      <Text size="xs" c="dimmed" mb="xs" px="xs">
        Commands
      </Text>
      <Stack gap={4}>
        {filteredCommands.map((command, index) => (
          <UnstyledButton
            key={command.id}
            onClick={() => command.action()}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor:
                index === selectedIndex
                  ? "var(--color-bg-tertiary)"
                  : "transparent",
              cursor: "pointer",
              transition: "background-color 0.1s ease",
            }}
          >
            <Group gap="sm">
              {command.icon}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500}>
                  {command.label}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {command.description}
                </Text>
              </div>
              <Text size="xs" c="dimmed" style={{ opacity: 0.6 }}>
                /{command.trigger}
              </Text>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Paper>
  );
}
