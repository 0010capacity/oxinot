import { Box, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useBlockStore } from "../stores/blockStore";

interface BlockPreview {
  id: string;
  content: string;
  childrenCount: number;
}

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  blocksToDelete: string[];
  totalBlocksCount: number;
  hasDescendants: boolean;
}

const truncateContent = (content: string, maxLength = 50): string => {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}...`;
};

export function DeleteConfirmModal({
  opened,
  onClose,
  onConfirm,
  blocksToDelete,
  totalBlocksCount,
  hasDescendants,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation();
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const blockPreviews: BlockPreview[] = blocksToDelete.map((id) => {
    const block = blocksById[id];
    if (!block) return { id, content: "Unknown block", childrenCount: 0 };

    const childrenCount = (childrenMap[id] || []).length;
    const content =
      block.content || t("common.untitled_block") || "Untitled Block";

    return {
      id,
      content: truncateContent(content, 60),
      childrenCount,
    };
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("common.delete") || "Delete"}
      centered
      withCloseButton
    >
      <Stack gap="sm" p="md">
        {blockPreviews.map((preview) => (
          <Box
            key={preview.id}
            p="sm"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              backgroundColor: "var(--color-surface-0)",
            }}
          >
            <Text size="sm" fw={500}>
              {preview.content}
            </Text>
            {preview.childrenCount > 0 && (
              <Text size="xs" c="dimmed" mt="xs">
                +{preview.childrenCount} child block
                {preview.childrenCount > 1 ? "s" : ""}
              </Text>
            )}
          </Box>
        ))}

        <Group gap="sm" align="flex-start">
          <IconInfoCircle size={20} color="var(--color-warning)" />
          <Text size="sm">
            {hasDescendants
              ? t("common.delete_confirm.descendants_warning", {
                  count: totalBlocksCount,
                }) ||
                `${totalBlocksCount} blocks will be deleted including descendants`
              : blocksToDelete.length === 1 && totalBlocksCount === 1
                ? t("common.delete_confirm.single") || "Delete this block?"
                : t("common.delete_confirm.multiple", {
                    count: totalBlocksCount,
                  }) || `Delete ${totalBlocksCount} blocks?`}
          </Text>
        </Group>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button
            variant="filled"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={onConfirm}
          >
            {t("common.delete") || "Delete"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
