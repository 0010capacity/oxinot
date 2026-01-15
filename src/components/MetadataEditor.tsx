import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Stack,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconBraces,
  IconHash,
  IconPlus,
  IconTextCaption,
  IconToggleLeft,
  IconTrash,
} from "@tabler/icons-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useBlockStore } from "../stores/blockStore";

type MetadataType = "text" | "number" | "boolean" | "json";

interface MetadataItem {
  key: string;
  value: string;
  type: MetadataType;
}

const guessType = (value: string): MetadataType => {
  const trimmed = value.trim();
  if (trimmed === "true" || trimmed === "false") return "boolean";
  if (!isNaN(Number(trimmed)) && trimmed !== "") return "number";
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  )
    return "json";
  return "text";
};

interface MetadataEditorProps {
  blockId: string;
  onClose: () => void;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  blockId,
  onClose,
}) => {
  const updateBlock = useBlockStore((state) => state.updateBlock);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBlock = useBlockStore((state: any) => state.getBlock);

  const [items, setItems] = useState<MetadataItem[]>([]);

  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  // Refs for managing focus
  const keyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const valueRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blockId) {
      const block = getBlock(blockId);
      if (block) {
        const loadedItems: MetadataItem[] = Object.entries(
          block.metadata || {}
        ).map(([key, value]) => ({
          key,
          value: String(value),
          type: guessType(String(value)),
        }));

        // Always start with at least one empty row if empty
        if (loadedItems.length === 0) {
          loadedItems.push({ key: "", value: "", type: "text" });
        }
        setItems(loadedItems);

        // Focus first item
        setTimeout(() => {
          keyRefs.current[0]?.focus({ preventScroll: true });
        }, 0);
      }
    }
  }, [blockId, getBlock]);

  const handleSave = () => {
    if (!blockId) return;

    const newMetadata: Record<string, string> = {};
    items.forEach((item) => {
      if (item.key.trim()) {
        newMetadata[item.key.trim()] = item.value;
      }
    });

    updateBlock(blockId, { metadata: newMetadata });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Mod+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
      return;
    }
    // Cancel on Escape
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
  };

  const addItem = () => {
    setItems([...items, { key: "", value: "", type: "text" }]);
    // Focus the new key input after render
    setTimeout(() => {
      keyRefs.current[items.length]?.focus({ preventScroll: true });
    }, 0);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    if (newItems.length === 0) {
      newItems.push({ key: "", value: "", type: "text" });
    }
    setItems(newItems);
    // Focus previous item or first item
    setTimeout(() => {
      const targetIndex = Math.max(0, index - 1);
      keyRefs.current[targetIndex]?.focus({ preventScroll: true });
    }, 0);
  };

  const updateItem = (
    index: number,
    field: keyof MetadataItem,
    value: string
  ) => {
    const newItems = [...items];
    // If updating value, try to auto-guess type if it's currently text or auto-detected
    let type = newItems[index].type;
    if (field === "value") {
      // Simple heuristic: if user changes value, re-evaluate type unless they manually set it?
      // For now, let's keep it simple: just update type if it matches a strong pattern
      const guessed = guessType(value);
      if (guessed !== "text" && type === "text") {
        type = guessed;
      }
    }

    newItems[index] = { ...newItems[index], [field]: value, type };
    setItems(newItems);
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    field: "key" | "value"
  ) => {
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (field === "key") {
        // Move to value
        valueRefs.current[index]?.focus();
      } else {
        // Move to next line or create new
        if (index === items.length - 1) {
          addItem();
        } else {
          keyRefs.current[index + 1]?.focus();
        }
      }
    } else if (
      e.key === "Backspace" &&
      field === "key" &&
      items[index].key === ""
    ) {
      // Delete empty row
      e.preventDefault();
      if (items.length > 1) {
        removeItem(index);
      }
    } else if (e.key === "ArrowUp") {
      // Navigate up
      if (index > 0) {
        e.preventDefault();
        (field === "key" ? keyRefs : valueRefs).current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowDown") {
      // Navigate down
      if (index < items.length - 1) {
        e.preventDefault();
        (field === "key" ? keyRefs : valueRefs).current[index + 1]?.focus();
      }
    }
  };

  const getTypeIcon = (type: MetadataType) => {
    switch (type) {
      case "number":
        return <IconHash size={14} />;
      case "boolean":
        return <IconToggleLeft size={14} />;
      case "json":
        return <IconBraces size={14} />;
      default:
        return <IconTextCaption size={14} />;
    }
  };

  return (
    <Box p="sm" onKeyDown={handleKeyDown} ref={containerRef}>
      <Stack gap="sm">
        {items.map((item, index) => (
          <Group key={index} align="flex-start" gap="md">
            <TextInput
              placeholder="Property"
              value={item.key}
              onChange={(e) => updateItem(index, "key", e.target.value)}
              onKeyDown={(e) => handleInputKeyDown(e, index, "key")}
              ref={(el) => {
                keyRefs.current[index] = el;
              }}
              style={{ flex: 1 }}
              variant="unstyled"
              data-autofocus={index === 0 && item.key === ""}
              styles={{
                input: {
                  borderBottom: `1px solid ${
                    isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                  }`,
                  borderRadius: 0,
                  paddingLeft: 0,
                  fontWeight: 500,
                  fontSize: "14px",
                },
              }}
            />

            <TextInput
              placeholder="Value"
              value={item.value}
              onChange={(e) => updateItem(index, "value", e.target.value)}
              onKeyDown={(e) => handleInputKeyDown(e, index, "value")}
              ref={(el) => {
                valueRefs.current[index] = el;
              }}
              style={{ flex: 2 }}
              variant="unstyled"
              styles={{
                input: {
                  borderBottom: `1px solid ${
                    isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                  }`,
                  borderRadius: 0,
                  paddingLeft: 0,
                  fontSize: "14px",
                },
              }}
              error={
                item.type === "number" &&
                item.value &&
                isNaN(Number(item.value))
                  ? true
                  : item.type === "json" && item.value
                  ? (() => {
                      try {
                        JSON.parse(item.value);
                        return false;
                      } catch {
                        return true;
                      }
                    })()
                  : false
              }
              rightSectionWidth={60}
              rightSection={
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      tabIndex={-1}
                      title={`Type: ${item.type}`}
                    >
                      {getTypeIcon(item.type)}
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Data Type</Menu.Label>
                    <Menu.Item
                      leftSection={<IconTextCaption size={14} />}
                      onClick={() => updateItem(index, "type", "text")}
                    >
                      Text
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconHash size={14} />}
                      onClick={() => updateItem(index, "type", "number")}
                    >
                      Number
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconToggleLeft size={14} />}
                      onClick={() => updateItem(index, "type", "boolean")}
                    >
                      Boolean
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconBraces size={14} />}
                      onClick={() => updateItem(index, "type", "json")}
                    >
                      JSON
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              }
            />

            <ActionIcon
              color="red"
              variant="transparent"
              onClick={() => removeItem(index)}
              tabIndex={-1}
              style={{ opacity: 0.5 }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}

        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconPlus size={16} />}
          onClick={addItem}
          size="sm"
          styles={{ root: { justifyContent: "flex-start", paddingLeft: 8 } }}
        >
          Add Property
        </Button>

        <Group justify="flex-end" mt="xs">
          <Box
            style={{
              fontSize: "11px",
              opacity: 0.4,
              fontFamily: "monospace",
              display: "flex",
              gap: "16px",
            }}
          >
            <span>↵ next</span>
            <span>⌘↵ save</span>
            <span>esc cancel</span>
          </Box>
        </Group>
      </Stack>
    </Box>
  );
};
