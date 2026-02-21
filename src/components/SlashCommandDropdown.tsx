import { Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

export interface SlashCommand {
  id: string;
  label: string;
  trigger: string;
}

interface Props {
  query: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandDropdown({
  query,
  position,
  onSelect,
  onClose,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: SlashCommand[] = useMemo(
    () => [
      { id: "ai", label: "AI Assistant", trigger: "ai" },
      { id: "code", label: "Code Block", trigger: "code" },
      { id: "bullet", label: "Bullet List", trigger: "bullet" },
      { id: "heading", label: "Heading", trigger: "heading" },
    ],
    [],
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredCommands.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [selectedIndex, filteredCommands, onClose, onSelect]);

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
      p={4}
      className="slash-command-dropdown"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1000,
        minWidth: 160,
        backgroundColor: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-secondary)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <Stack gap={1}>
        {filteredCommands.map((command, index) => (
          <UnstyledButton
            key={command.id}
            onClick={() => onSelect(command)}
            style={{
              width: "100%",
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor:
                index === selectedIndex
                  ? "var(--color-bg-tertiary)"
                  : "transparent",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text size="sm">{command.label}</Text>
            <Text size="xs" c="dimmed" style={{ opacity: 0.5 }}>
              /{command.trigger}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
    </Paper>
  );
}
