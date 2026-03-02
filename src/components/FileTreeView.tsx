import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { type FileSystemItem, tauriAPI } from "../tauri-api";
import { BulletPoint } from "./common/BulletPoint";
import { CollapseToggle } from "./common/CollapseToggle";
import { ContextMenu, type ContextMenuSection } from "./common/ContextMenu";
import { ContentWrapper } from "./layout/ContentWrapper";
import { PageContainer } from "./layout/PageContainer";
import { PageHeader } from "./layout/PageHeader";

interface FileTreeNodeProps {
  item: FileSystemItem;
  level: number;
  onFileClick: (path: string) => void;
  onRequestDelete: (item: FileSystemItem) => void;
}

const INDENT_SIZE = 24;

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  item,
  level,
  onFileClick,
  onRequestDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileSystemItem[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { renameItem } = useWorkspaceStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleToggle = async () => {
    if (item.is_directory) {
      if (!isExpanded) {
        try {
          const items = await tauriAPI.readDirectory(item.path);
          setChildren(items);
        } catch (error) {
          console.error("[FileTreeView] Error loading children:", error);
        }
      }
      setIsExpanded(!isExpanded);
    } else if (item.is_file && item.name.endsWith(".md")) {
      onFileClick(item.path);
    }
  };

  const handleRename = () => {
    const currentName = item.name.replace(".md", "");
    setNewName(currentName);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async () => {
    if (!newName.trim() || newName === item.name.replace(".md", "")) {
      setIsRenaming(false);
      return;
    }

    const finalName =
      item.is_file && !newName.endsWith(".md") ? `${newName}.md` : newName;

    try {
      await renameItem(item.path, finalName);
      setIsRenaming(false);
    } catch (error) {
      console.error("[FileTreeView] Error renaming item:", error);
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  const contextMenuSections: ContextMenuSection[] = [
    {
      items: [
        {
          label: t("common.context_menu.rename"),
          onClick: handleRename,
        },
        {
          label: t("common.context_menu.copy_path"),
          onClick: () => {
            navigator.clipboard.writeText(item.path);
          },
        },
      ],
    },
    {
      items: [
        {
          label: t("common.context_menu.delete"),
          color: "red",
          onClick: () => {
            onRequestDelete(item);
          },
        },
      ],
    },
  ];

  const isMarkdownFile = item.is_file && item.name.endsWith(".md");
  const showItem = item.is_directory || isMarkdownFile;

  if (!showItem) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <ContextMenu sections={contextMenuSections}>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              paddingTop: "2px",
              paddingBottom: "2px",
              paddingLeft: `${level * INDENT_SIZE}px`,
              paddingRight: "var(--spacing-sm)",
              borderRadius: "var(--radius-sm)",
              transition: "background-color var(--transition-normal)",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "none",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-interactive-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {/* Collapse/Expand Toggle */}
            {item.is_directory ? (
              <CollapseToggle
                isCollapsed={!isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                style={{
                  opacity: isExpanded
                    ? "var(--opacity-dimmed)"
                    : "var(--opacity-disabled)",
                }}
              />
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  width: "var(--layout-collapse-toggle-size)",
                  height: "var(--layout-collapse-toggle-size)",
                }}
              />
            )}

            {/* Bullet Point */}
            <BulletPoint type="default" />

            {/* Name or Rename Input */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "2px 8px",
                  backgroundColor: "var(--color-interactive-hover)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-sm)",
                  outline: "none",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "24px",
                }}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "24px",
                  fontWeight: item.is_directory ? 500 : 400,
                }}
              >
                {item.name.replace(".md", "")}
              </div>
            )}
          </button>
        </div>
      </ContextMenu>

      {item.is_directory && isExpanded && children.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              item={child}
              level={level + 1}
              onFileClick={onFileClick}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTreeView: React.FC = () => {
  const { workspacePath, fileTree, openFile, currentPath } =
    useWorkspaceStore();
  const { deleteItem } = useWorkspaceStore();
  const { t } = useTranslation();

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);

  if (!workspacePath) {
    return null;
  }

  const pathParts = currentPath?.split("/") || [];
  const currentFolder = pathParts[pathParts.length - 1] || "Workspace";

  const handleRequestDelete = (item: FileSystemItem) => {
    setItemToDelete(item);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem(itemToDelete.path);
      setDeleteModalOpened(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("[FileTreeView] Failed to delete item:", error);
      alert(`Failed to delete: ${error}`);
    }
  };

  return (
    <PageContainer>
      <ContentWrapper>
        <PageHeader title={currentFolder} />

        <Stack gap={0}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "var(--font-size-sm)",
              lineHeight: "var(--line-height-normal)",
            }}
          >
            {fileTree.map((item) => (
              <FileTreeNode
                key={item.path}
                item={item}
                level={0}
                onFileClick={openFile}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </div>
        </Stack>
      </ContentWrapper>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setItemToDelete(null);
        }}
        title={t("common.delete_page")}
        centered
        size="sm"
      >
        <Stack gap="lg">
          <Text size="sm">
            {t("common.delete_page_question", {
              title: itemToDelete?.name.replace(".md", "") || "",
            })}
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                setDeleteModalOpened(false);
                setItemToDelete(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageContainer>
  );
};
