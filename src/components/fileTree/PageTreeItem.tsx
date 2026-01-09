import React, { useEffect, useState, useRef } from "react";
import { TextInput, Group, ActionIcon, Text } from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconFolderPlus,
  IconEdit,
} from "@tabler/icons-react";
import { useViewStore } from "../../stores/viewStore";
import { usePageStore, type PageData } from "../../stores/pageStore";
import { useBlockStore } from "../../stores/blockStore";
import { CollapseToggle } from "../common/CollapseToggle";
import { BulletPoint } from "../common/BulletPoint";
import { IndentGuide } from "../common/IndentGuide";

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

  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = !!children;
  const isCollapsed = collapsed[page.id];
  const isDraggedOver = dragOverPageId === page.id;
  const isDragging = draggedPageId === page.id;

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
            alignItems: "flex-start",
            gap: "var(--spacing-sm)",
            paddingLeft: `${depth * 24}px`,
            paddingTop: "2px",
            paddingBottom: "2px",
            position: "relative",
            borderRadius: "var(--radius-sm)",
            transition: "background-color var(--transition-normal)",
            userSelect: "none",
            zIndex: 2,
          }}
        >
          {/* Collapse/Expand Toggle */}
          {hasChildren ? (
            <CollapseToggle
              isCollapsed={isCollapsed}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(page.id);
              }}
              style={{
                opacity: isCollapsed
                  ? "var(--opacity-disabled)"
                  : isHovered
                    ? "var(--opacity-dimmed)"
                    : 0,
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
                  color: "var(--color-text-primary)",
                  userSelect: "none",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "24px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                  paddingLeft: "4px",
                  paddingRight: "8px",
                  cursor: "pointer",
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit(page.id);
                }}
              >
                {page.title}
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

      {/* Children */}
      {!isCollapsed && children}
    </div>
  );
}
