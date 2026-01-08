import { useEffect, useState, useCallback, useRef } from "react";
import {
  Stack,
  Text,
  Group,
  Loader,
  useMantineColorScheme,
  ActionIcon,
  TextInput,
} from "@mantine/core";
import {
  IconPlus,
  IconCheck,
  IconX,
  IconGripVertical,
  IconChevronRight,
  IconChevronDown,
  IconFolderPlus,
} from "@tabler/icons-react";
import { useViewStore } from "../stores/viewStore";
import { usePageStore, type PageData } from "../stores/pageStore";
import { useBlockStore } from "../stores/blockStore";

interface PageTreeItemProps {
  page: PageData;
  depth: number;
  onEdit: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAddChild: (parentId: string) => void;
  onDragStart: (pageId: string) => void;
  onDragOver: (e: React.DragEvent, pageId: string) => void;
  onDrop: (e: React.DragEvent, pageId: string) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (pageId: string) => void;
  children?: React.ReactNode;
}

function PageTreeItem({
  page,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onDragStart,
  onDragOver,
  onDrop,
  isEditing,
  editValue,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  collapsed,
  onToggleCollapse,
  children,
}: PageTreeItemProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { openNote } = useViewStore();
  const { selectPage } = usePageStore();
  const { loadPage } = useBlockStore();

  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = !!children;
  const isCollapsed = collapsed[page.id] || false;

  const handlePageClick = async () => {
    if (isEditing) return;
    try {
      selectPage(page.id);
      await loadPage(page.id);
      openNote(page.id, page.title);
    } catch (error) {
      console.error("Failed to open page:", error);
    }
  };

  const handleBulletClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleCollapse(page.id);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
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

  const indentSize = 24;
  const paddingLeft = depth * indentSize;

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        if (!isEditing) {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(page.id);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(e, page.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e, page.id);
      }}
      style={{
        position: "relative",
      }}
    >
      <Group
        gap="xs"
        wrap="nowrap"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          paddingLeft: `${paddingLeft}px`,
          paddingTop: "4px",
          paddingBottom: "4px",
          paddingRight: "8px",
          cursor: isEditing ? "default" : "pointer",
          borderRadius: "4px",
          transition: "background-color 0.15s ease",
          backgroundColor:
            isHovered && !isEditing
              ? isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.03)"
              : "transparent",
        }}
        onClick={isEditing ? undefined : handlePageClick}
      >
        {/* Drag Handle - visible on hover */}
        <div
          style={{
            width: "16px",
            opacity: isHovered && !isEditing ? 0.4 : 0,
            transition: "opacity 0.15s ease",
            cursor: "grab",
          }}
        >
          <IconGripVertical size={16} />
        </div>

        {/* Bullet/Collapse Icon */}
        <div
          onClick={handleBulletClick}
          style={{
            width: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: hasChildren ? "pointer" : "default",
          }}
        >
          {hasChildren ? (
            isCollapsed ? (
              <IconChevronRight
                size={14}
                style={{
                  opacity: 0.6,
                  transition: "transform 0.15s ease",
                }}
              />
            ) : (
              <IconChevronDown
                size={14}
                style={{
                  opacity: 0.6,
                  transition: "transform 0.15s ease",
                }}
              />
            )
          ) : (
            <Text
              size="sm"
              style={{
                fontFamily: "monospace",
                fontSize: "18px",
                opacity: 0.4,
                userSelect: "none",
              }}
            >
              •
            </Text>
          )}
        </div>

        {/* Page Title or Edit Input */}
        {isEditing ? (
          <TextInput
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditChange(e.currentTarget.value)}
            onKeyDown={handleEditKeyDown}
            size="xs"
            style={{ flex: 1 }}
            styles={{
              input: {
                border: "none",
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            }}
          />
        ) : (
          <Text
            size="sm"
            style={{
              flex: 1,
              color: isDark ? "#4dabf7" : "#1c7ed6",
              userSelect: "none",
            }}
          >
            {page.title}
            {page.isDirectory && (
              <Text
                component="span"
                size="xs"
                c="dimmed"
                ml={4}
                style={{ opacity: 0.5 }}
              >
                ({children ? React.Children.count(children) : 0})
              </Text>
            )}
          </Text>
        )}

        {/* Action Buttons - visible on hover */}
        {isHovered && !isEditing && (
          <Group gap={4}>
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(page.id);
              }}
              title="Add child page"
            >
              <IconFolderPlus size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(page.id);
              }}
              title="Rename"
            >
              <IconCheck size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  window.confirm(
                    `Delete "${page.title}"? This action cannot be undone.`,
                  )
                ) {
                  onDelete(page.id);
                }
              }}
              title="Delete"
            >
              <IconX size={12} />
            </ActionIcon>
          </Group>
        )}

        {/* Edit Confirmation Buttons */}
        {isEditing && (
          <Group gap={4}>
            <ActionIcon
              size="xs"
              color="green"
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                onEditSubmit();
              }}
            >
              <IconCheck size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              color="red"
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
            >
              <IconX size={12} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div style={{ position: "relative" }}>{children}</div>
      )}
    </div>
  );
}

export function FileTreeIndex() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { loadPages, createPage, updatePageTitle, deletePage, movePage } =
    usePageStore();
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]),
  );
  const isLoading = usePageStore((state) => state.isLoading);

  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createPage(newPageTitle.trim(), creatingParentId || undefined);
      setNewPageTitle("");
      setIsCreating(false);
      setCreatingParentId(null);

      // Expand parent if creating child
      if (creatingParentId) {
        setCollapsed((prev) => ({
          ...prev,
          [creatingParentId]: false,
        }));
      }
    } catch (error) {
      console.error("Failed to create page:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCreate = () => {
    setNewPageTitle("");
    setIsCreating(false);
    setCreatingParentId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreatePage();
    } else if (e.key === "Escape") {
      handleCancelCreate();
    }
  };

  const handleEditPage = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (page) {
      setEditingPageId(pageId);
      setEditValue(page.title);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingPageId || !editValue.trim()) return;

    try {
      await updatePageTitle(editingPageId, editValue.trim());
      setEditingPageId(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update page title:", error);
    }
  };

  const handleEditCancel = () => {
    setEditingPageId(null);
    setEditValue("");
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await deletePage(pageId);
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  const handleAddChild = (parentId: string) => {
    setCreatingParentId(parentId);
    setIsCreating(true);
    // Expand parent to show new child input
    setCollapsed((prev) => ({
      ...prev,
      [parentId]: false,
    }));
  };

  const handleToggleCollapse = (pageId: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  };

  const handleDragStart = (pageId: string) => {
    setDraggedPageId(pageId);
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, pageId: string) => {
      if (draggedPageId !== pageId) {
        setDragOverPageId(pageId);
      }
    },
    [draggedPageId],
  );

  const handleDrop = async (e: React.DragEvent, targetPageId: string) => {
    e.stopPropagation();

    if (!draggedPageId || draggedPageId === targetPageId) {
      setDraggedPageId(null);
      setDragOverPageId(null);
      return;
    }

    try {
      // Move the dragged page to be a child of the target page
      await movePage(draggedPageId, targetPageId);
      await loadPages();
    } catch (error) {
      console.error("Failed to move page:", error);
    } finally {
      setDraggedPageId(null);
      setDragOverPageId(null);
    }
  };

  // Build hierarchical structure
  const buildTree = (parentId: string | undefined): PageData[] => {
    return pages
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const renderPageTree = (page: PageData, depth: number): React.ReactNode => {
    const children = buildTree(page.id);
    const hasChildren = children.length > 0;
    const isCreatingChild = isCreating && creatingParentId === page.id;

    return (
      <div key={page.id}>
        <PageTreeItem
          page={page}
          depth={depth}
          onEdit={handleEditPage}
          onDelete={handleDeletePage}
          onAddChild={handleAddChild}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          isEditing={editingPageId === page.id}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditSubmit={handleEditSubmit}
          onEditCancel={handleEditCancel}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        >
          {hasChildren &&
            children.map((child) => renderPageTree(child, depth + 1))}
          {isCreatingChild && renderNewPageInput(depth + 1)}
        </PageTreeItem>
      </div>
    );
  };

  const renderNewPageInput = (depth: number) => {
    const indentSize = 24;
    const paddingLeft = depth * indentSize;

    return (
      <Group
        gap="xs"
        wrap="nowrap"
        style={{
          paddingLeft: `${paddingLeft}px`,
          paddingTop: "4px",
          paddingBottom: "4px",
          paddingRight: "8px",
        }}
      >
        <div style={{ width: "16px" }} />
        <Text
          size="sm"
          style={{
            fontFamily: "monospace",
            fontSize: "18px",
            opacity: 0.4,
            userSelect: "none",
            width: "20px",
            textAlign: "center",
          }}
        >
          •
        </Text>
        <TextInput
          placeholder="Page title..."
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
          autoFocus
          style={{ flex: 1 }}
          size="xs"
          styles={{
            input: {
              border: "none",
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.05)",
            },
          }}
        />
        <ActionIcon
          color="green"
          variant="light"
          onClick={handleCreatePage}
          disabled={!newPageTitle.trim() || isSubmitting}
          loading={isSubmitting}
          size="xs"
        >
          <IconCheck size={12} />
        </ActionIcon>
        <ActionIcon
          color="red"
          variant="light"
          onClick={handleCancelCreate}
          disabled={isSubmitting}
          size="xs"
        >
          <IconX size={12} />
        </ActionIcon>
      </Group>
    );
  };

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="100%" p="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading pages...
        </Text>
      </Stack>
    );
  }

  const rootPages = buildTree(undefined);

  return (
    <Stack gap={0} p="md">
      {/* Header with New Page Button */}
      <Group
        justify="space-between"
        mb="md"
        style={{
          paddingBottom: "8px",
          borderBottom: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
        }}
      >
        <Text size="sm" fw={600} c="dimmed">
          PAGES
        </Text>
        {!isCreating && (
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => setIsCreating(true)}
            title="New Page"
          >
            <IconPlus size={16} />
          </ActionIcon>
        )}
      </Group>

      {/* New Page Input (root level only) */}
      {isCreating && !creatingParentId && renderNewPageInput(0)}

      {/* Pages Tree */}
      {rootPages.length === 0 && !isCreating ? (
        <Stack align="center" justify="center" h="200px">
          <Text size="sm" c="dimmed">
            No pages found. Create your first page!
          </Text>
        </Stack>
      ) : (
        <Stack gap={0}>
          {rootPages.map((page) => renderPageTree(page, 0))}
        </Stack>
      )}
    </Stack>
  );
}
