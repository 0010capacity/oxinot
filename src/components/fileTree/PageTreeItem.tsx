import { useSortable } from "@dnd-kit/sortable";
import {
  ActionIcon,
  Group,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type React from "react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { INDENT_PER_LEVEL } from "../../constants/layout";
import { useBlockStore } from "../../stores/blockStore";
import { type PageData, usePageStore } from "../../stores/pageStore";
import { useViewStore } from "../../stores/viewStore";
import { BulletPoint } from "../common/BulletPoint";
import { CollapseToggle } from "../common/CollapseToggle";
import { ContextMenu, type ContextMenuSection } from "../common/ContextMenu";
import { IndentGuide } from "../common/IndentGuide";

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
  childCount?: number;
  onEdit: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAddChild: (parentId: string) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (pageId: string) => void;
  dragOverPageId: string | null;
  showIndentGuides?: boolean;
  isCreating?: boolean;
  creatingParentId?: string | null;
  isSubmitting?: boolean;
  children?: React.ReactNode;
}

export const PageTreeItem = memo(function PageTreeItem({
  page,
  depth,
  childCount,
  onEdit,
  onDelete,
  onAddChild,
  isEditing,
  editValue,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  collapsed,
  onToggleCollapse,
  dragOverPageId,
  showIndentGuides = true,
  children,
}: PageTreeItemProps) {
  void childCount; // Suppress unused variable warning

  const openNote = useViewStore((state) => state.openNote);
  const selectPage = usePageStore((state) => state.selectPage);
  const loadPage = useBlockStore((state) => state.loadPage);
  const { t } = useTranslation();

  const inputRef = useRef<HTMLInputElement>(null);

  // DnD sortable hook for drag-and-drop
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: page.id,
  });

  const hasChildren = !!children;
  const isCollapsed = collapsed[page.id];
  const isDraggedOver = dragOverPageId === page.id;

  // Only apply opacity change when dragging, no transform/transition needed
  // since file tree is alphabetically sorted (no reordering)
  const dndStyle: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,
  };

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
              onDelete(page.id);
            },
          },
        ],
      },
    ],
    [page.id, onAddChild, onEdit, onDelete, t],
  );

  const handlePageClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditing) return;

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

      pagePathIds.push(page.id);

      selectPage(page.id);
      startTransition(() => {
        openNote(page.id, page.title, parentNames, pagePathIds);
      });

      try {
        await loadPage(page.id);
      } catch (error) {
        console.error("[PageTreeItem] Failed to load page:", error);
      }
    },
    [page.id, page.parentId, page.title, isEditing, loadPage, selectPage, openNote],
  );

  const handleBulletClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasChildren) {
        onToggleCollapse(page.id);
      }
    },
    [hasChildren, onToggleCollapse, page.id],
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onEditSubmit();
      } else if (e.key === "Escape") {
        onEditCancel();
      }
    },
    [onEditSubmit, onEditCancel],
  );

  const moveFocus = useCallback((direction: number) => {
    const buttons = Array.from(
      document.querySelectorAll(".page-tree-item-button"),
    ) as HTMLElement[];
    const currentIndex = buttons.indexOf(document.activeElement as HTMLElement);
    if (currentIndex !== -1) {
      const nextIndex = currentIndex + direction;
      if (nextIndex >= 0 && nextIndex < buttons.length) {
        buttons[nextIndex].focus();
      }
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (hasChildren && isCollapsed) {
          e.preventDefault();
          e.stopPropagation();
          onToggleCollapse(page.id);
        }
      } else if (e.key === "ArrowLeft") {
        if (hasChildren && !isCollapsed) {
          e.preventDefault();
          e.stopPropagation();
          onToggleCollapse(page.id);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(-1);
      }
    },
    [hasChildren, isCollapsed, onToggleCollapse, page.id, moveFocus],
  );

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
          ref={setNodeRef}
          style={{
            ...dndStyle,
            position: "relative",
            cursor: isEditing ? "default" : "pointer",
            userSelect: isDragging ? "none" : "auto",
          }}
          {...attributes}
          {...listeners}
        >
          {isDraggedOver && !isDragging && (
            <div
              style={{
                position: "absolute",
                left: `${depth * INDENT_PER_LEVEL}px`,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: "rgba(128, 128, 128, 0.08)",
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
              marginLeft: `${depth * INDENT_PER_LEVEL}px`,
            }}
          >
            {/* Collapse/Expand Toggle */}
            <div data-action-button="true">
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
                      : 0
                    : 0,
                  visibility: hasChildren ? "visible" : "hidden",
                }}
              />
            </div>

            {/* Bullet Point */}
            <div data-action-button="true">
              <BulletPoint onClick={handleBulletClick} />
            </div>

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
              <UnstyledButton
                className="page-tree-item-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePageClick(e);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit(page.id);
                }}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  color: "var(--color-text-primary)",
                  userSelect: "none",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "24px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                  paddingLeft: "4px",
                  paddingRight: "8px",
                  fontWeight: page.isDirectory ? 500 : 400,
                  textAlign: "left",
                }}
                aria-label={page.title}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
              >
                <Text size="sm" truncate>
                  {getPageBasename(page.title)}
                </Text>
              </UnstyledButton>
            )}
          </div>
        </div>
      </ContextMenu>

      {/* Children */}
      {!isCollapsed && children}
    </div>
  );
});
