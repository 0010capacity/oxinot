import {
  IconIndentDecrease,
  IconIndentIncrease,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useBlockStore } from "../stores/blockStore";
import { useViewStore } from "../stores/viewStore";
import { useRegisterCommands, type Command } from "../stores/commandStore";
import { showToast } from "../utils/toast";
import React, { useMemo } from "react";

interface UseBlockEditorCommandsProps {
  onClose?: () => void;
}

export function useBlockEditorCommands({
  onClose,
}: UseBlockEditorCommandsProps) {
  const { t } = useTranslation();
  const focusedBlockId = useViewStore((state) => state.focusedBlockId);
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const createBlock = useBlockStore((state) => state.createBlock);
  const deleteBlock = useBlockStore((state) => state.deleteBlock);
  const indentBlock = useBlockStore((state) => state.indentBlock);
  const outdentBlock = useBlockStore((state) => state.outdentBlock);
  const toggleCollapse = useBlockStore((state) => state.toggleCollapse);

  const blockEditorCommands: Command[] = useMemo(() => {
    const cmds: Command[] = [];

    const currentBlock = focusedBlockId ? blocksById[focusedBlockId] : null;
    const hasChildren =
      focusedBlockId && childrenMap[focusedBlockId]
        ? childrenMap[focusedBlockId].length > 0
        : false;

    // Only add block commands if we have a focused block
    if (focusedBlockId && currentBlock) {
      cmds.push(
        {
          id: "new-block",
          label: t("commands.new_block.label", "New Block"),
          description: t(
            "commands.new_block.description",
            "Create a new block after current block"
          ),
          icon: React.createElement(IconPlus, { size: 16 }),
          action: async () => {
            onClose?.();
            try {
              const newBlockId = await createBlock(focusedBlockId, "");
              if (newBlockId) {
                showToast({
                  message: "New block created",
                  type: "success",
                });
              }
            } catch (error) {
              console.error("Failed to create block:", error);
              showToast({
                message: "Failed to create block",
                type: "error",
              });
            }
          },
          keywords: ["create", "add", "block", "new"],
          category: "Block",
          order: 10,
        },
        {
          id: "delete-block",
          label: t("commands.delete_block.label", "Delete Block"),
          description: t(
            "commands.delete_block.description",
            "Delete current block"
          ),
          icon: React.createElement(IconTrash, { size: 16 }),
          action: async () => {
            onClose?.();
            if (
              window.confirm(
                t(
                  "commands.delete_block.confirm",
                  "Are you sure you want to delete this block?"
                )
              )
            ) {
              try {
                await deleteBlock(focusedBlockId);
                showToast({
                  message: "Block deleted",
                  type: "success",
                });
              } catch (error) {
                console.error("Failed to delete block:", error);
                showToast({
                  message: "Failed to delete block",
                  type: "error",
                });
              }
            }
          },
          keywords: ["delete", "remove", "block", "trash"],
          category: "Block",
          order: 20,
        },
        {
          id: "indent-block",
          label: t("commands.indent_block.label", "Indent Block"),
          description: t(
            "commands.indent_block.description",
            "Indent current block"
          ),
          icon: React.createElement(IconIndentIncrease, { size: 16 }),
          action: async () => {
            onClose?.();
            try {
              await indentBlock(focusedBlockId);
              showToast({
                message: "Block indented",
                type: "success",
              });
            } catch (error) {
              console.error("Failed to indent block:", error);
              showToast({
                message: "Failed to indent block",
                type: "error",
              });
            }
          },
          keywords: ["indent", "nest", "deeper", "block"],
          category: "Block",
          order: 30,
        },
        {
          id: "outdent-block",
          label: t("commands.outdent_block.label", "Outdent Block"),
          description: t(
            "commands.outdent_block.description",
            "Outdent current block"
          ),
          icon: React.createElement(IconIndentDecrease, { size: 16 }),
          action: async () => {
            onClose?.();
            try {
              await outdentBlock(focusedBlockId);
              showToast({
                message: "Block outdented",
                type: "success",
              });
            } catch (error) {
              console.error("Failed to outdent block:", error);
              showToast({
                message: "Failed to outdent block",
                type: "error",
              });
            }
          },
          keywords: ["outdent", "unindent", "shallower", "block"],
          category: "Block",
          order: 40,
        }
      );

      // Only show toggle collapse if block has children
      if (hasChildren) {
        cmds.push({
          id: "toggle-collapse",
          label: currentBlock.isCollapsed
            ? t("commands.expand_block.label", "Expand Block")
            : t("commands.collapse_block.label", "Collapse Block"),
          description: currentBlock.isCollapsed
            ? t(
                "commands.expand_block.description",
                "Expand current block and show children"
              )
            : t(
                "commands.collapse_block.description",
                "Collapse current block and hide children"
              ),
          icon: React.createElement(
            currentBlock.isCollapsed ? IconChevronRight : IconChevronDown,
            { size: 16 }
          ),
          action: async () => {
            onClose?.();
            try {
              await toggleCollapse(focusedBlockId);
              showToast({
                message: currentBlock.isCollapsed
                  ? "Block expanded"
                  : "Block collapsed",
                type: "success",
              });
            } catch (error) {
              console.error("Failed to toggle collapse:", error);
              showToast({
                message: "Failed to toggle collapse",
                type: "error",
              });
            }
          },
          keywords: ["collapse", "expand", "toggle", "fold"],
          category: "Block",
          order: 50,
        });
      }
    }

    return cmds;
  }, [
    focusedBlockId,
    blocksById,
    childrenMap,
    createBlock,
    deleteBlock,
    indentBlock,
    outdentBlock,
    toggleCollapse,
    onClose,
    t,
  ]);

  useRegisterCommands(blockEditorCommands);
}
