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
  IconFolderPlus,
} from "@tabler/icons-react";
import { useViewStore } from "../stores/viewStore";
import { usePageStore, type PageData } from "../stores/pageStore";
import { useBlockStore } from "../stores/blockStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface DragState {
  isDragging: boolean;
  draggedPageId: string | null;
  dragOverPageId: string | null;
  startY: number;
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
  children?: React.ReactNode;
}

function PageTreeItem({
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
  children,
}: PageTreeItemProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
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

    console.log("[PageTreeItem] Page clicked:", page.title);
    await selectPage(page.id);
    await loadPage(page.id);
    openNote(page.id, page.title);
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
    <div>
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
          opacity: isDragging ? 0.5 : 1,
          transition: "opacity 0.2s ease",
          cursor: isEditing ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        {/* Drop indicator */}
        {isDraggedOver && draggedPageId !== page.id && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: isDark
                ? "rgba(99, 102, 241, 0.15)"
                : "rgba(99, 102, 241, 0.1)",
              borderRadius: "3px",
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
            gap: "6px",
            paddingLeft: `${depth * 24}px`,
            paddingTop: "2px",
            paddingBottom: "2px",
            position: "relative",
            borderRadius: "3px",
            transition: "background-color 0.15s ease",
          }}
        >
          {/* Collapse/Expand Toggle - like BlockComponent */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(page.id);
              }}
              style={{
                flexShrink: 0,
                width: "20px",
                height: "20px",
                padding: 0,
                margin: "2px 0 0 8px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "currentColor",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isCollapsed ? 0.3 : isHovered ? 0.5 : 0,
                transition: "opacity 0.15s ease, background-color 0.15s ease",
                borderRadius: "3px",
                position: "relative",
                zIndex: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isCollapsed
                  ? "0.3"
                  : isHovered
                    ? "0.5"
                    : "0";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
          ) : (
            <div
              style={{
                flexShrink: 0,
                width: "20px",
                height: "20px",
                margin: "2px 0 0 8px",
              }}
            />
          )}

          {/* Bullet Point - exactly like BlockComponent */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleBulletClick(e);
            }}
            style={{
              flexShrink: 0,
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: 0,
              position: "relative",
              cursor: hasChildren ? "pointer" : "default",
            }}
          >
            <div
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.4)"
                  : "rgba(0, 0, 0, 0.4)",
                transition: "all 0.2s ease",
                display: "block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(0, 0, 0, 0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.4)"
                  : "rgba(0, 0, 0, 0.4)";
              }}
            />
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
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.03)",
                    fontSize: "14px",
                    lineHeight: "1.5",
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
                  color: isDark ? "#e0e0e0" : "#1a1a1a",
                  userSelect: "none",
                  fontSize: "14px",
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
                    transition: "opacity 0.2s ease",
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
                    ✏️
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="red"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Delete "${page.title}"? This will delete all content and cannot be undone.`,
                        )
                      ) {
                        onDelete(page.id);
                      }
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
      {!isCollapsed && children && (
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
  const isLoading = usePageStore((state) => state.isLoading);

  // Use single selector to ensure atomic updates
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]).filter(Boolean),
  );

  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedPageId: null,
    dragOverPageId: null,
    startY: 0,
  });

  useEffect(() => {
    console.log("[FileTreeIndex] Initial load pages");
    loadPages().then(() => {
      console.log("[FileTreeIndex] Initial pages loaded");
    });
  }, [loadPages]);

  // Monitor pages changes
  useEffect(() => {
    console.log("[FileTreeIndex] pages changed! New length:", pages.length);
  }, [pages.length]);

  // Mouse-based drag and drop
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;

      // Find element under cursor
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const pageElement = elements.find((el) =>
        el.getAttribute("data-page-id"),
      );

      if (pageElement) {
        const pageId = pageElement.getAttribute("data-page-id");
        if (pageId && pageId !== dragState.draggedPageId) {
          setDragState((prev) => ({ ...prev, dragOverPageId: pageId }));
        }
      } else {
        setDragState((prev) => ({ ...prev, dragOverPageId: null }));
      }
    };

    const handleMouseUp = async () => {
      if (!dragState.isDragging) return;

      const { draggedPageId, dragOverPageId } = dragState;

      // Reset drag state
      setDragState({
        isDragging: false,
        draggedPageId: null,
        dragOverPageId: null,
        startY: 0,
      });

      // Perform drop if valid
      if (draggedPageId && dragOverPageId && draggedPageId !== dragOverPageId) {
        console.log(
          `[FileTreeIndex] Dropping ${draggedPageId} on ${dragOverPageId}`,
        );
        try {
          await movePage(draggedPageId, dragOverPageId);
          await loadPages();
          setCollapsed((prev) => ({
            ...prev,
            [dragOverPageId]: false,
          }));
          console.log("[FileTreeIndex] Page moved successfully");
        } catch (error) {
          console.error("Failed to move page:", error);
          alert(`Failed to move page: ${error}`);
        }
      }
    };

    if (dragState.isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, movePage, loadPages]);

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

      // Reload pages to update UI
      console.log("[FileTreeIndex] Reloading pages...");
      await loadPages();
      console.log("[FileTreeIndex] Pages reloaded. Total pages:", pages.length);

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
      await loadPages();
      setEditingPageId(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update page:", error);
    }
  };

  const handleEditCancel = () => {
    setEditingPageId(null);
    setEditValue("");
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await deletePage(pageId);
      await loadPages();
    } catch (error) {
      console.error("Failed to delete page:", error);
      alert(`Failed to delete page: ${error}`);
    }
  };

  const handleAddChild = (parentId: string) => {
    setCreatingParentId(parentId);
    setIsCreating(true);

    // Expand parent when adding child
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

  const handleMouseDown = (e: React.MouseEvent, pageId: string) => {
    // Only start drag on left mouse button and if not clicking on interactive elements
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return;
    }

    console.log("[FileTreeIndex] Starting drag:", pageId);
    setDragState({
      isDragging: true,
      draggedPageId: pageId,
      dragOverPageId: null,
      startY: e.clientY,
    });
  };

  // Build hierarchical tree
  const buildTree = useCallback(
    (parentId: string | null): PageData[] => {
      return pages
        .filter((page) => {
          const pageParentId = page.parentId ?? null;
          return pageParentId === parentId;
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    },
    [pages],
  );

  // Render page tree recursively
  const renderPageTree = (page: PageData, depth: number): React.ReactNode => {
    const children = buildTree(page.id);
    const hasChildren = children.length > 0;
    const isCreatingChild = isCreating && creatingParentId === page.id;

    return (
      <React.Fragment key={page.id}>
        <PageTreeItem
          page={page}
          depth={depth}
          onEdit={handleEditPage}
          onDelete={handleDeletePage}
          onAddChild={handleAddChild}
          onMouseDown={handleMouseDown}
          isEditing={editingPageId === page.id}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditSubmit={handleEditSubmit}
          onEditCancel={handleEditCancel}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          draggedPageId={dragState.draggedPageId}
          dragOverPageId={dragState.dragOverPageId}
        >
          {hasChildren &&
            !collapsed[page.id] &&
            children.map((child) => renderPageTree(child, depth + 1))}

          {isCreatingChild && renderNewPageInput(depth + 1)}
        </PageTreeItem>
      </React.Fragment>
    );
  };

  const renderNewPageInput = (depth: number) => {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6px",
          paddingLeft: `${depth * 24}px`,
          paddingTop: "2px",
          paddingBottom: "2px",
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.03)"
            : "rgba(0, 0, 0, 0.02)",
          borderRadius: "3px",
          border: `1px solid ${isDark ? "rgba(99, 102, 241, 0.3)" : "rgba(99, 102, 241, 0.2)"}`,
          margin: "2px 0",
        }}
      >
        <div style={{ width: "20px", height: "20px", margin: "2px 0 0 8px" }} />
        <div
          style={{
            flexShrink: 0,
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.3)"
                : "rgba(0, 0, 0, 0.3)",
            }}
          />
        </div>

        <Group gap={4} wrap="nowrap" style={{ flex: 1, paddingRight: "8px" }}>
          <TextInput
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="New page title..."
            autoFocus
            size="xs"
            disabled={isSubmitting}
            styles={{
              input: {
                border: "none",
                backgroundColor: "transparent",
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "24px",
              },
            }}
            style={{ flex: 1 }}
          />

          <ActionIcon
            variant="subtle"
            onClick={handleCreatePage}
            disabled={isSubmitting || !newPageTitle.trim()}
            size="xs"
            color="green"
            style={{ opacity: newPageTitle.trim() ? 1 : 0.3 }}
          >
            <IconCheck size={12} />
          </ActionIcon>
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
      </div>
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

  const rootPages = buildTree(null);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "40px 20px",
        overflowY: "auto",
        backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          paddingBottom: "200px",
        }}
      >
        <Stack gap={0}>
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
              PAGES ({pages.length})
            </Text>
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
                    paddingLeft: "56px",
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
      </div>
    </div>
  );
}
