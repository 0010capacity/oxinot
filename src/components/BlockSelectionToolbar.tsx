import {
  Group,
  Badge,
  ActionIcon,
  Menu,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  IconTrash,
  IconIndentIncrease,
  IconIndentDecrease,
  IconCopy,
  IconX,
} from "@tabler/icons-react";
import { useBlockUIStore } from "../stores/blockUIStore";
import * as batchOps from "../utils/batchBlockOperations";

interface BlockSelectionToolbarProps {
  selectedCount: number;
  onDelete?: () => Promise<void>;
  onIndent?: () => Promise<void>;
  onOutdent?: () => Promise<void>;
}

export const BlockSelectionToolbar: React.FC<BlockSelectionToolbarProps> = ({
  selectedCount,
  onDelete,
  onIndent,
  onOutdent,
}) => {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme();
  const isDark = computedColorScheme === "dark";
  const selectedBlockIds = useBlockUIStore((state) => state.selectedBlockIds);
  const clearSelectedBlocks = useBlockUIStore(
    (state) => state.clearSelectedBlocks
  );

  const canIndent = batchOps.canIndentBlocks(selectedBlockIds);
  const canOutdent = batchOps.canOutdentBlocks(selectedBlockIds);

  const handleDelete = useCallback(async () => {
    if (onDelete) {
      await onDelete();
    }
  }, [onDelete]);

  const handleIndent = useCallback(async () => {
    if (onIndent) {
      await onIndent();
    }
  }, [onIndent]);

  const handleOutdent = useCallback(async () => {
    if (onOutdent) {
      await onOutdent();
    }
  }, [onOutdent]);

  const handleCopyIds = useCallback(async () => {
    try {
      await batchOps.copyBlockIdsToClipboard(selectedBlockIds);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [selectedBlockIds]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <Group
      p="md"
      bg={isDark ? "transparent" : "var(--mantine-color-gray-0)"}
      style={{
        borderTop: "1px solid var(--mantine-color-gray-3)",
        borderBottom: "1px solid var(--mantine-color-gray-3)",
      }}
    >
      <Badge size="lg" variant="light" color="gray">
        {selectedCount} {selectedCount === 1 ? "block" : "blocks"} selected
      </Badge>

      <Group gap="xs" ml="auto">
        {/* Indent Button */}
        <Tooltip
          label={t("common.indent") || "Indent"}
          withArrow
          position="top"
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleIndent}
            disabled={!canIndent}
            aria-label="Indent selected blocks"
          >
            <IconIndentIncrease size={18} />
          </ActionIcon>
        </Tooltip>

        {/* Outdent Button */}
        <Tooltip
          label={t("common.outdent") || "Outdent"}
          withArrow
          position="top"
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleOutdent}
            disabled={!canOutdent}
            aria-label="Outdent selected blocks"
          >
            <IconIndentDecrease size={18} />
          </ActionIcon>
        </Tooltip>

        {/* More Options Menu */}
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="More options">
              <IconCopy size={18} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item onClick={handleCopyIds}>Copy Block IDs</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* Delete Button */}
        <Tooltip
          label={t("common.delete") || "Delete"}
          withArrow
          position="top"
        >
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={handleDelete}
            aria-label="Delete selected blocks"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>

        {/* Clear Selection Button */}
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={clearSelectedBlocks}
          aria-label="Clear selection"
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
};
