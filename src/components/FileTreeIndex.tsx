import React, { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import { useWorkspaceStore } from "../stores/workspaceStore";

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
  draggedPageId: string | null;
  dragOverPageId: string | null;
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
  draggedPageId,
  dragOverPageId,
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
  const isDraggedOver = dragOverPageId === page.id;
  const isDragging = draggedPageId === page.id;

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        if (!isEditing) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", page.id);
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
        e.stopPropagation();
        onDrop(e, page.id);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "relative",
        opacity: isDragging ? 0.5 : 1,
        transition: "opacity 0.15s ease",
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
          transition: "background-color 0.15s ease, border 0.15s ease",
          backgroundColor:
            isHovered && !isEditing
              ? isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.03)"
              : "transparent",
          border: isDraggedOver
            ? `2px solid ${isDark ? "#4dabf7" : "#1c7ed6"}`
            : "2px solid transparent",
          position: "relative",
        }}
        onClick={isEditing ? undefined : handlePageClick}
      >
        {isDraggedOver && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: isDark
                ? "rgba(77, 171, 247, 0.1)"
                : "rgba(28, 126, 214, 0.1)",
              borderRadius: "4px",
              pointerEvents: "none",
            }}
          />
        )}
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
  const pageIds = usePageStore((state) => state.pageIds);
  const pagesById = usePageStore((state) => state.pagesById);
  const isLoading = usePageStore((state) => state.isLoading);

  // Build pages array from separate selectors for proper reactivity
  const pages = pageIds.map((id) => pagesById[id]).filter(Boolean);

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
    console.log("[FileTreeIndex] Initial load pages");
    loadPages().then(() => {
      console.log("[FileTreeIndex] Initial pages loaded:", pageIds.length);
    });
  }, [loadPages]);

  // Reset drag state on drag end
  useEffect(() => {
    const handleDragEnd = () => {
      setDraggedPageId(null);
      setDragOverPageId(null);
    };

    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    setIsSubmitting(true);
    try {
      console.log(
        "[FileTreeIndex] Creating page:",
        newPageTitle.trim(),
        "parent:",
        creatingParentId,
      );
      const newPageId = await createPage(
        newPageTitle.trim(),
        creatingParentId || undefined,
      );
      console.log("[FileTreeIndex] Page created with ID:", newPageId);

      // Sync workspace to ensure file is in DB
      const { workspacePath } = useWorkspaceStore.getState();
      if (workspacePath) {
        console.log("[FileTreeIndex] Syncing workspace after page creation...");
        await invoke("sync_workspace", { workspacePath });
      }

      // Debug: Check DB state
      const dbState = await invoke<string>("debug_db_state");
      console.log("[FileTreeIndex] DB state after sync:\n", dbState);

      // Reload pages to update UI
      console.log("[FileTreeIndex] Reloading pages...");
      await loadPages();
      console.log(
        "[FileTreeIndex] Pages reloaded. Total pages:",
        pageIds.length,
      );

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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

      // Reload pages to update UI
      await loadPages();

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

      // Reload pages to update UI
      await loadPages();
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

      // Reload pages to update UI
      await loadPages();

      // Expand target to show moved child
      setCollapsed((prev) => ({
        ...prev,
        [targetPageId]: false,
      }));
    } catch (error) {
      console.error("Failed to move page:", error);
    } finally {
      setDraggedPageId(null);
      setDragOverPageId(null);
    }
  };

  // Build hierarchical structure
  const buildTree = useCallback(
    (parentId: string | undefined): PageData[] => {
      return pages
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.title.localeCompare(b.title));
    },
    [pages],
  );

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
          draggedPageId={draggedPageId}
          dragOverPageId={dragOverPageId}
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
          backgroundColor: isDark
            ? "rgba(77, 171, 247, 0.08)"
            : "rgba(28, 126, 214, 0.08)",
          borderRadius: "4px",
          border: `1px solid ${isDark ? "rgba(77, 171, 247, 0.2)" : "rgba(28, 126, 214, 0.2)"}`,
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
          placeholder="Type page name and press Enter..."
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Auto-submit on blur if there's content
            if (newPageTitle.trim() && !isSubmitting) {
              handleCreatePage();
            }
          }}
          disabled={isSubmitting}
          autoFocus
          style={{ flex: 1 }}
          size="xs"
          styles={{
            input: {
              border: "none",
              backgroundColor: "transparent",
              fontWeight: 500,
            },
          }}
        />
        {isSubmitting && <Loader size="xs" />}
        <ActionIcon
          variant="subtle"
          onClick={handleCancelCreate}
          disabled={isSubmitting}
          size="xs"
          style={{ opacity: 0.5 }}
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
    <Stack gap={0} p="md" style={{ position: "relative", height: "100%" }}>
      {/* Header */}
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
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={async () => {
            const dbState = await invoke<string>("debug_db_state");
            console.log("=== DB STATE ===\n", dbState);
            alert(dbState);
          }}
          title="Debug DB State"
        >
          🔍
        </ActionIcon>
      </Group>

      {/* Pages Tree */}
      {rootPages.length === 0 && !isCreating ? (
        <Stack align="center" justify="center" h="200px">
          <Text size="sm" c="dimmed">
            No pages found. Create your first page!
          </Text>
          <ActionIcon
            size="lg"
            variant="light"
            onClick={() => setIsCreating(true)}
            title="New Page"
            style={{ marginTop: "8px" }}
          >
            <IconPlus size={20} />
          </ActionIcon>
        </Stack>
      ) : (
        <Stack gap={0} style={{ flex: 1 }}>
          {rootPages.map((page) => renderPageTree(page, 0))}

          {/* New Page Input at bottom */}
          {isCreating && !creatingParentId && (
            <div style={{ marginTop: "8px" }}>{renderNewPageInput(0)}</div>
          )}

          {/* Floating New Page Button */}
          {!isCreating && (
            <Group
              gap="xs"
              wrap="nowrap"
              style={{
                paddingLeft: "36px",
                paddingTop: "8px",
                paddingBottom: "4px",
                cursor: "pointer",
                borderRadius: "4px",
                transition: "background-color 0.15s ease",
                opacity: 0.6,
              }}
              onClick={() => setIsCreating(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.03)"
                  : "rgba(0, 0, 0, 0.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.6";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <IconPlus size={16} style={{ opacity: 0.5 }} />
              <Text size="sm" c="dimmed" style={{ userSelect: "none" }}>
                New page
              </Text>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}
