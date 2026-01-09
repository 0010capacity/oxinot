import React, {
  useEffect,
  useState,
  useCallback,
  createContext,
  useMemo,
  memo,
} from "react";
import {
  Stack,
  Text,
  Group,
  Loader,
  ActionIcon,
  Modal,
  Button,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { usePageStore, type PageData } from "../stores/pageStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { PageContainer } from "./layout/PageContainer";
import { ContentWrapper } from "./layout/ContentWrapper";
import { PageHeader } from "./layout/PageHeader";
import { PageTreeItem } from "./fileTree/PageTreeItem";
import { NewPageInput } from "./fileTree/NewPageInput";
import { IndentGuide } from "./common/IndentGuide";

interface DragState {
  isDragging: boolean;
  draggedPageId: string | null;
  dragOverPageId: string | null;
  startY: number;
}

// Create isolated drag context to prevent cascading re-renders
export const DragContext = createContext<DragState>({
  isDragging: false,
  draggedPageId: null,
  dragOverPageId: null,
  startY: 0,
});

// Memoized PageTreeItem wrapper to prevent unnecessary re-renders
const MemoizedPageTreeItem = memo(PageTreeItem, (prev, next) => {
  return (
    prev.page.id === next.page.id &&
    prev.page.title === next.page.title &&
    prev.page.updatedAt === next.page.updatedAt &&
    prev.depth === next.depth &&
    prev.isEditing === next.isEditing &&
    prev.editValue === next.editValue &&
    prev.collapsed[prev.page.id] === next.collapsed[next.page.id] &&
    prev.draggedPageId === next.draggedPageId &&
    prev.dragOverPageId === next.dragOverPageId
  );
});

MemoizedPageTreeItem.displayName = "MemoizedPageTreeItem";

export function FileTreeIndex() {
  const { loadPages, createPage, updatePageTitle, deletePage, movePage } =
    usePageStore();
  const isLoading = usePageStore((state) => state.isLoading);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const workspaceName = workspacePath?.split("/").pop() || "Workspace";
  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides,
  );

  // Use single selector to ensure atomic updates
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]).filter(Boolean),
  );

  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
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
  const draggedPageId = dragState.draggedPageId;
  const dragOverPageId = dragState.dragOverPageId;

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageData | null>(null);

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

      // Prevent text selection while dragging
      e.preventDefault();

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

  const handleCreatePage = useCallback(
    async (title: string) => {
      if (!title.trim()) return;

      setIsSubmitting(true);
      try {
        console.log(
          "[FileTreeIndex] Creating page:",
          title.trim(),
          "parent:",
          creatingParentId,
        );
        const newPageId = await createPage(
          title.trim(),
          creatingParentId || undefined,
        );
        console.log("[FileTreeIndex] Page created with ID:", newPageId);

        // Reload pages to update UI
        console.log("[FileTreeIndex] Reloading pages...");
        await loadPages();
        console.log(
          "[FileTreeIndex] Pages reloaded. Total pages:",
          pages.length,
        );

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
    },
    [creatingParentId, createPage, loadPages, pages.length],
  );

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setCreatingParentId(null);
  }, []);

  const handleEditPage = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId);
      if (page) {
        setEditingPageId(pageId);
        setEditValue(page.title);
      }
    },
    [pages],
  );

  const handleEditSubmit = useCallback(async () => {
    if (!editingPageId || !editValue.trim()) return;

    try {
      await updatePageTitle(editingPageId, editValue.trim());
      await loadPages();
      setEditingPageId(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update page:", error);
    }
  }, [editingPageId, editValue, updatePageTitle, loadPages]);

  const handleEditCancel = useCallback(() => {
    setEditingPageId(null);
    setEditValue("");
  }, []);

  const handleDeletePage = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;

      setPageToDelete(page);
      setDeleteModalOpened(true);
    },
    [pages],
  );

  const confirmDeletePage = useCallback(async () => {
    if (!pageToDelete) return;

    try {
      await deletePage(pageToDelete.id);
      await loadPages();
      setDeleteModalOpened(false);
      setPageToDelete(null);
    } catch (error) {
      console.error("Failed to delete page:", error);
      alert(`Failed to delete page: ${error}`);
    }
  }, [pageToDelete, deletePage, loadPages]);

  const handleAddChild = useCallback((parentId: string) => {
    setCreatingParentId(parentId);
    setIsCreating(true);

    // Expand parent when adding child
    setCollapsed((prev) => ({
      ...prev,
      [parentId]: false,
    }));
  }, []);

  const handleToggleCollapse = useCallback((pageId: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, pageId: string) => {
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

    // Prevent text selection during drag
    e.preventDefault();

    // Clear any existing text selection
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }

    setDragState({
      isDragging: true,
      draggedPageId: pageId,
      dragOverPageId: null,
      startY: e.clientY,
    });
  }, []);

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
  const renderPageTree = useCallback(
    (page: PageData, depth: number): React.ReactNode => {
      const children = pages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      const isCreatingChild = isCreating && creatingParentId === page.id;

      return (
        <React.Fragment key={page.id}>
          {/* Indent guides for nested levels */}
          <IndentGuide depth={depth} show={showIndentGuides} />

          <MemoizedPageTreeItem
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
            draggedPageId={draggedPageId}
            dragOverPageId={dragOverPageId}
          >
            {hasChildren || isCreatingChild ? (
              <>
                {children.map((child) => renderPageTree(child, depth + 1))}
                {isCreatingChild && (
                  <NewPageInput
                    depth={depth + 1}
                    onSubmit={handleCreatePage}
                    onCancel={handleCancelCreate}
                    isSubmitting={isSubmitting}
                  />
                )}
              </>
            ) : null}
          </MemoizedPageTreeItem>
        </React.Fragment>
      );
    },
    [
      pages,
      isCreating,
      creatingParentId,
      showIndentGuides,
      handleEditPage,
      handleDeletePage,
      handleAddChild,
      handleMouseDown,
      editingPageId,
      editValue,
      handleEditSubmit,
      handleEditCancel,
      collapsed,
      handleToggleCollapse,
      draggedPageId,
      dragOverPageId,
      handleCreatePage,
      handleCancelCreate,
      isSubmitting,
    ],
  );

  const rootPages = useMemo(() => buildTree(null), [buildTree]);

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

  return (
    <PageContainer>
      <ContentWrapper>
        {/* Workspace Title */}
        <PageHeader title={workspaceName} />

        <Stack gap={0} style={{ position: "relative" }}>
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
                <div style={{ marginTop: "8px" }}>
                  <NewPageInput
                    depth={0}
                    onSubmit={handleCreatePage}
                    onCancel={handleCancelCreate}
                    isSubmitting={isSubmitting}
                  />
                </div>
              )}

              {/* Floating New Page Button */}
              {!isCreating && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                    paddingLeft: "0px",
                    paddingTop: "8px",
                    paddingBottom: "4px",
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                    transition: "background-color var(--transition-normal)",
                    opacity: "var(--opacity-hover)",
                  }}
                  onClick={() => setIsCreating(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.backgroundColor =
                      "var(--color-interactive-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "var(--opacity-hover)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Spacer for collapse toggle */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: "var(--layout-collapse-toggle-size)",
                      height: "var(--layout-collapse-toggle-size)",
                    }}
                  />

                  {/* Plus icon at bullet position */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: "var(--layout-bullet-container-size)",
                      height: "var(--layout-bullet-container-size)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconPlus
                      size={16}
                      style={{ opacity: "var(--opacity-dimmed)" }}
                    />
                  </div>

                  <Text
                    size="sm"
                    c="dimmed"
                    style={{
                      userSelect: "none",
                      paddingLeft: "4px",
                    }}
                  >
                    New page
                  </Text>
                </div>
              )}
            </Stack>
          )}
        </Stack>
      </ContentWrapper>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setPageToDelete(null);
        }}
        title="Delete Page"
        centered
        size="sm"
      >
        <Stack gap="lg">
          <Text size="sm">
            Delete <strong>{pageToDelete?.title}</strong>?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                setDeleteModalOpened(false);
                setPageToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button color="red" onClick={confirmDeletePage}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageContainer>
  );
}
