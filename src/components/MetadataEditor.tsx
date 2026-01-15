import {
  ActionIcon,
  Box,
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
  IconX,
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
  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") return "number";
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  )
    return "json";
  return "text";
};

const getTypeLabel = (type: MetadataType): string => {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
      return "json";
    default:
      return "text";
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

  const handleSaveAndClose = () => {
    if (!blockId) return;

    const newMetadata: Record<string, string> = {};
    for (const item of items) {
      if (item.key.trim()) {
        newMetadata[item.key.trim()] = item.value;
      }
    }

    updateBlock(blockId, { metadata: newMetadata });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape closes the editor and saves
    if (e.key === "Escape") {
      e.preventDefault();
      handleSaveAndClose();
      return;
    }
    // Cmd+Enter saves and closes
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveAndClose();
      return;
    }
  };

  const addItem = () => {
    setItems([...items, { key: "", value: "", type: "text" }]);
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
    let type = newItems[index].type;

    if (field === "value") {
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
        valueRefs.current[index]?.focus();
      } else {
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
      e.preventDefault();
      if (items.length > 1) {
        removeItem(index);
      }
    } else if (e.key === "ArrowUp") {
      if (index > 0) {
        e.preventDefault();
        (field === "key" ? keyRefs : valueRefs).current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowDown") {
      if (index < items.length - 1) {
        e.preventDefault();
        (field === "key" ? keyRefs : valueRefs).current[index + 1]?.focus();
      }
    }
  };

  return (
    <Box onKeyDown={handleKeyDown} style={{ minWidth: "450px" }}>
      <Stack gap={0}>
        {/* Header */}
        <Group justify="space-between" p="sm" pb={8}>
          <Box style={{ fontSize: "12px", fontWeight: 600, opacity: 0.6 }}>
            METADATA
          </Box>
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={handleSaveAndClose}
            title="Close"
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>

        {/* Divider */}
        <Box
          style={{
            height: "1px",
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            margin: "0 8px 8px",
          }}
        />

        {/* Items */}
        <Stack gap="xs" px="sm">
          {items.map((item, index) => (
            <Group key={index} align="center" gap={8} wrap="nowrap">
              {/* Property Name */}
              <TextInput
                placeholder="key"
                value={item.key}
                onChange={(e) => updateItem(index, "key", e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, index, "key")}
                ref={(el) => {
                  keyRefs.current[index] = el;
                }}
                style={{ flex: 0.6, minWidth: 0 }}
                variant="unstyled"
                styles={{
                  input: {
                    fontSize: "13px",
                    padding: "4px 6px",
                    border: `1px solid ${
                      isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"
                    }`,
                    borderRadius: "4px",
                    background: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
              />

              {/* Type Badge */}
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    tabIndex={-1}
                    title={`Type: ${getTypeLabel(item.type)}`}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      minWidth: "50px",
                      height: "28px",
                    }}
                  >
                    <Group gap={4} wrap="nowrap">
                      {getTypeIcon(item.type)}
                      <span>{getTypeLabel(item.type)}</span>
                    </Group>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
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

              {/* Value */}
              <TextInput
                placeholder="value"
                value={item.value}
                onChange={(e) => updateItem(index, "value", e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, index, "value")}
                ref={(el) => {
                  valueRefs.current[index] = el;
                }}
                style={{ flex: 1, minWidth: 0 }}
                variant="unstyled"
                styles={{
                  input: {
                    fontSize: "13px",
                    padding: "4px 6px",
                    border: `1px solid ${
                      isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"
                    }`,
                    borderRadius: "4px",
                    background: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
                error={
                  item.type === "number" &&
                  item.value &&
                  Number.isNaN(Number(item.value))
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
              />

              {/* Delete Button */}
              <ActionIcon
                color="red"
                variant="subtle"
                size="sm"
                onClick={() => removeItem(index)}
                tabIndex={-1}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>

        {/* Add Property Button */}
        <Group px="sm" pt={8}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={addItem}
            title="Add property"
          >
            <IconPlus size={14} />
          </ActionIcon>
          <span style={{ fontSize: "12px", opacity: 0.5 }}>add property</span>
        </Group>

        {/* Footer Help Text */}
        <Box
          px="sm"
          pt={8}
          pb="sm"
          style={{
            fontSize: "11px",
            opacity: 0.4,
            fontFamily: "monospace",
          }}
        >
          ↵ next • esc close
        </Box>
      </Stack>
    </Box>
  );
};
