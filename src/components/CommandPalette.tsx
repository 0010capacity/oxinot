import { Box, Kbd, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useCommandStore } from "../stores/commandStore";

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
}

export function CommandPalette({ opened, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const registeredCommands = useCommandStore((state) => state.commands);

  const commands = useMemo(() => {
    return Object.values(registeredCommands).sort((a, b) => {
      // Sort by category first, then by order, then by label
      const catA = a.category || "";
      const catB = b.category || "";
      if (catA !== catB) return catA.localeCompare(catB);

      const orderA = a.order ?? 100;
      const orderB = b.order ?? 100;
      if (orderA !== orderB) return orderA - orderB;

      return a.label.localeCompare(b.label);
    });
  }, [registeredCommands]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((kw) =>
        kw.toLowerCase().includes(lowerQuery)
      );
      const categoryMatch = cmd.category?.toLowerCase().includes(lowerQuery);
      return labelMatch || descMatch || keywordMatch || categoryMatch;
    });
  }, [commands, query]);

  useEffect(() => {
    if (opened) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [opened]);

  useEffect(() => {
    if (query !== undefined) {
      setSelectedIndex(0);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredCommands.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredCommands.length > 0) {
      e.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (command) {
        command.action();
      }
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Command Palette"
      size="lg"
      styles={{
        title: {
          fontSize: "1.1rem",
          fontWeight: 600,
        },
      }}
    >
      <Stack gap="md">
        <TextInput
          data-autofocus
          placeholder="Type a command or search..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          styles={{
            input: {
              fontSize: "0.95rem",
            },
          }}
          rightSection={
            <Box style={{ display: "flex", gap: "4px" }}>
              <Kbd size="xs">↑</Kbd>
              <Kbd size="xs">↓</Kbd>
              <Kbd size="xs">⏎</Kbd>
            </Box>
          }
        />

        {filteredCommands.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No commands found
          </Text>
        ) : (
          <Box
            style={{
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <Stack gap={2}>
              {filteredCommands.map((command, index) => (
                <Box
                  key={command.id}
                  onClick={() => command.action()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor:
                      selectedIndex === index
                        ? "var(--color-interactive-hover)"
                        : "transparent",
                    border: `1px solid ${
                      selectedIndex === index
                        ? "var(--color-border-secondary)"
                        : "transparent"
                    }`,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--color-text-tertiary)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {command.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "8px",
                        }}
                      >
                        <Text
                          size="sm"
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                          }}
                        >
                          {command.label}
                        </Text>
                        {command.category && (
                          <Text
                            size="xs"
                            style={{
                              color: "var(--color-text-tertiary)",
                              fontSize: "0.7rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {command.category}
                          </Text>
                        )}
                      </div>
                      {command.description && (
                        <Text
                          size="xs"
                          style={{
                            color: "var(--color-text-tertiary)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {command.description}
                        </Text>
                      )}
                    </div>
                  </div>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
