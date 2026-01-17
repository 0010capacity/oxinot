import { ActionIcon, Group, Text, TextInput } from "@mantine/core";
import {
  IconCheck,
  IconEdit,
  IconFolderPlus,
  IconX,
} from "@tabler/icons-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBlockStore } from "../../stores/blockStore";
import { type PageData, usePageStore } from "../../stores/pageStore";
import { useViewStore } from "../../stores/viewStore";
import { BulletPoint } from "../common/BulletPoint";
import { CollapseToggle } from "../common/CollapseToggle";
import { IndentGuide } from "../common/IndentGuide";
import { ContextMenu, type ContextMenuSection } from "../common/ContextMenu";
import { useTranslation } from "react-i18next";

// Extract basename from path (e.g., "A/B/C" -> "C")
function getPageBasename(title: string): string {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

interface PageTreeItemProps {
  page: PageData;
  depth: number;
  onEdit: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAddChild: (parentId: string) => void;
  onMouseDown: (e: React.MouseEvent, pageId: string) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (pageId: string) => void;
  draggedPageId: string | null;
  dragOverPageId: string | null;
  showIndentGuides?: boolean;
  children?: React.ReactNode;
}

export function PageTreeItem({
  page,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onMouseDown,
  isEditing,
  editValue,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  collapsed,
  onToggleCollapse,
  draggedPageId,
  dragOverPageId,
  showIndentGuides = true,
  children,
}: PageTreeItemProps) {
  const openNote = useViewStore((state) => state.openNote);
  const selectPage = usePageStore((state) => state.selectPage);
  const loadPage = useBlockStore((state) => state.loadPage);
  const { t } = useTranslation();

  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = !!children;
  const isCollapsed = collapsed[page.id];
  const isDraggedOver = dragOverPageId === page.id;
  const isDragging = draggedPageId === page.id;

  // Context menu sections
  const contextMenuSections: ContextMenuSection[] = useMemo(
    () => [
      {
        items: [
          {
            label: t("common.context_menu.add_child"),
            onClick: () => {
              onAddChild(page.id);
            },
          },
          {
            label: t("common.context_menu.rename"),
            onClick: () => {
              onEdit(page.id);
            },
          },
          {
            label: t("common.context_menu.copy_id"),
            onClick: () => {
              navigator.clipboard.writeText(page.id);
            },
          },
          {
            label: t("common.context_menu.delete"),
            color: "red",
            onClick: () => {
              console.log("[PageTreeItem] Delete clicked for page:", {
                id: page.id,
                title: page.title,
                parentId: page.parentId,
              });
              onDelete(page.id);
            },
          },
        ],
      },
    ],
    [page.id, page.title, page.parentId, onAddChild, onEdit, onDelete, t]
  );

  const handlePageClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;

    // Build parent path for breadcrumb
    const parentNames: string[] = [];
    const pagePathIds: string[] = [];
    let currentParentId = page.parentId;
    const { pagesById } = usePageStore.getState();

    while (currentParentId) {
      const parentPage = pagesById[currentParentId];
      if (parentPage) {
        parentNames.unshift(parentPage.title);
        pagePathIds.unshift(currentParentId);
        currentParentId = parentPage.parentId;
      } else {
        break;
      }
    }

    // Add current page ID at the end
    pagePathIds.push(page.id);

    await selectPage(page.id);
    await loadPage(page.id);
    openNote(page.id, page.title, parentNames, pagePathIds);
  };

  const handleBulletClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleCollapse(page.id);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEditSubmit();
    } else if (e.key === "Escape") {
      onEditCancel();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div style={{ position: "relative" }}>
      {/* Indent guides */}
      {showIndentGuides && depth > 0 && (
        <IndentGuide depth={depth} show={true} />
      )}

      <ContextMenu sections={contextMenuSections}>
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={(e) => {
            if (!isEditing && e.button === 0) {
              onMouseDown(e, page.id);
            }
          }}
          style={{
            position: "relative",
            opacity: isDragging ? "var(--opacity-dimmed)" : 1,
            transition: "opacity var(--transition-slow)",
            cursor: isEditing ? "default" : "pointer",
            userSelect: isDragging ? "none" : "auto",
          }}
        >
          {/* Drop indicator */}
          {isDraggedOver && draggedPageId !== page.id && (
            <div
              style={{
                position: "absolute",
                left: `${depth * 24}px`,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: "var(--color-interactive-selected)",
                borderRadius: "var(--radius-sm)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

          <div
            data-page-id={page.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              paddingTop: "2px",
              paddingBottom: "2px",
              position: "relative",
              borderRadius: "var(--radius-sm)",
              transition: "background-color var(--transition-normal)",
              userSelect: "none",
              zIndex: 2,
              marginLeft: `${depth * 24}px`,
            }}
          >
            {/* Collapse/Expand Toggle */}
            <CollapseToggle
              isCollapsed={isCollapsed}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(page.id);
              }}
              style={{
                opacity: hasChildren
                  ? isCollapsed
                    ? "var(--opacity-disabled)"
                    : isHovered
                    ? "var(--opacity-dimmed)"
                    : 0
                  : 0,
                visibility: hasChildren ? "visible" : "hidden",
              }}
            />

            {/* Bullet Point */}
            <BulletPoint onClick={handleBulletClick} />

            {/* Page Title or Edit Input */}
            {isEditing ? (
              <Group gap={4} wrap="nowrap" style={{ flex: 1 }}>
                <TextInput
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => onEditChange(e.currentTarget.value)}
                  onKeyDown={handleEditKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  size="xs"
                  styles={{
                    input: {
                      border: "none",
                      backgroundColor: "var(--color-interactive-hover)",
                      fontSize: "var(--font-size-sm)",
                      lineHeight: "var(--line-height-normal)",
                    },
                  }}
                  style={{
                    flex: 1,
                  }}
                />

                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSubmit();
                    }}
                    size="xs"
                    color="green"
                    title="Save"
                  >
                    <IconCheck size={12} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCancel();
                    }}
                    size="xs"
                    color="red"
                    title="Cancel"
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Group>
              </Group>
            ) : (
              <>
                <Text
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageClick(e);
                  }}
                  style={{
                    flex: 1,
                    color: "var(--color-accent)",
                    userSelect: "none",
                    fontSize: "var(--font-size-sm)",
                    lineHeight: "24px",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                    paddingLeft: "4px",
                    paddingRight: "8px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEdit(page.id);
                  }}
                >
                  {getPageBasename(page.title)}
                </Text>

                {/* Action buttons */}
                {isHovered && !isEditing && (
                  <Group
                    gap={4}
                    wrap="nowrap"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity var(--transition-slow)",
                    }}
                  >
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(page.id);
                      }}
                      title="Add child page"
                    >
                      <IconFolderPlus size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(page.id);
                      }}
                      title="Rename"
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(
                          "[PageTreeItem] Delete button clicked for page:",
                          {
                            id: page.id,
                            title: page.title,
                            parentId: page.parentId,
                          }
                        );
                        onDelete(page.id);
                      }}
                      title="Delete"
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                )}
              </>
            )}
          </div>
        </div>
      </ContextMenu>

      {/* Children */}
      {!isCollapsed && children}
    </div>
  );
}
