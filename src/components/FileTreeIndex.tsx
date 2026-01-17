import { Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import React, {
  useEffect,
  useState,
  useCallback,
  createContext,
  useMemo,
  memo,
} from "react";
import { useTranslation } from "react-i18next";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { type PageData, usePageStore } from "../stores/pageStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { NewPageInput } from "./fileTree/NewPageInput";
import { PageTreeItem } from "./fileTree/PageTreeItem";
import { ContentWrapper } from "./layout/ContentWrapper";
import { PageContainer } from "./layout/PageContainer";
import { PageHeader } from "./layout/PageHeader";

interface DragState {
  isDragging: boolean;
  draggedPageId: string | null;
  dragOverPageId: string | null;
  startY: number;
  startX: number;
  mouseX: number;
  mouseY: number;
}

const DRAG_THRESHOLD = 5; // pixels to move before considering it a drag

// Create isolated drag context to prevent cascading re-renders
export const DragContext = createContext<DragState>({
  isDragging: false,
  draggedPageId: null,
  dragOverPageId: null,
  startY: 0,
  startX: 0,
  mouseX: 0,
  mouseY: 0,
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
    prev.dragOverPageId === next.dragOverPageId &&
    prev.showIndentGuides === next.showIndentGuides
  );
});

MemoizedPageTreeItem.displayName = "MemoizedPageTreeItem";

export function FileTreeIndex() {
  const { t } = useTranslation();
  const { loadPages, createPage, updatePageTitle, deletePage, movePage } =
    usePageStore();
  const isLoading = usePageStore((state) => state.isLoading);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const workspaceName = workspacePath?.split("/").pop() || "Workspace";
  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides
  );

  // Use single selector to ensure atomic updates
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]).filter(Boolean)
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
    startX: 0,
    mouseX: 0,
    mouseY: 0,
  });
  const draggedPageId = dragState.draggedPageId;
  const dragOverPageId = dragState.dragOverPageId;

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageData | null>(null);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Mouse-based drag and drop
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Check if we should start dragging (threshold check)
      if (dragState.draggedPageId && !dragState.isDragging) {
        const deltaX = Math.abs(e.clientX - dragState.startX);
        const deltaY = Math.abs(e.clientY - dragState.startY);

        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          setDragState((prev) => ({ ...prev, isDragging: true }));
        }
        return;
      }

      if (!dragState.isDragging) return;

      // Prevent text selection while dragging
      e.preventDefault();

      // Update mouse position
      setDragState((prev) => ({
        ...prev,
        mouseX: e.clientX,
        mouseY: e.clientY,
      }));

      // Find element under cursor
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const pageElement = elements.find((el) =>
        el.getAttribute("data-page-id")
      );
      const dropZone = elements.find(
        (el) => el.getAttribute("data-drop-zone") === "root"
      );

      if (pageElement) {
        const pageId = pageElement.getAttribute("data-page-id");
        if (pageId && pageId !== dragState.draggedPageId) {
          setDragState((prev) => ({ ...prev, dragOverPageId: pageId }));
        }
      } else if (dropZone) {
        // Hovering over root drop zone
        setDragState((prev) => ({ ...prev, dragOverPageId: "root" }));
      } else {
        setDragState((prev) => ({ ...prev, dragOverPageId: null }));
      }
    };

    const handleMouseUp = async () => {
      const { draggedPageId, dragOverPageId, isDragging } = dragState;

      console.log("[FileTreeIndex.handleMouseUp] Called with:", {
        draggedPageId,
        dragOverPageId,
        isDragging,
      });

      // Reset drag state
      setDragState({
        isDragging: false,
        draggedPageId: null,
        dragOverPageId: null,
        startY: 0,
        startX: 0,
        mouseX: 0,
        mouseY: 0,
      });

      // If we never started dragging (just a click), do nothing
      if (!isDragging) {
        console.log("[FileTreeIndex.handleMouseUp] No drag detected, exiting");
        return;
      }

      // Perform drop if valid
      if (draggedPageId) {
        const draggedPage = pages.find((p) => p.id === draggedPageId);
        const targetPage = pages.find((p) => p.id === dragOverPageId);

        console.log("[FileTreeIndex.handleMouseUp] Dragged page:", {
          id: draggedPage?.id,
          title: draggedPage?.title,
          currentParentId: draggedPage?.parentId,
        });

        if (dragOverPageId === "root") {
          // Move to root level
          console.log(
            `[FileTreeIndex.handleMouseUp] Moving ${draggedPageId} to root`
          );
          console.log(
            "[FileTreeIndex.handleMouseUp] Pages state BEFORE movePage:",
            pages.map((p) => ({
              id: p.id,
              title: p.title,
              parentId: p.parentId,
            }))
          );

          try {
            await movePage(draggedPageId, null);
            console.log(
              "[FileTreeIndex.handleMouseUp] movePage completed, now calling loadPages..."
            );
            await loadPages();
            console.log(
              "[FileTreeIndex.handleMouseUp] loadPages completed, checking final state..."
            );

            const finalPage = usePageStore.getState().pagesById[draggedPageId];
            console.log("[FileTreeIndex.handleMouseUp] Final page state:", {
              id: finalPage?.id,
              title: finalPage?.title,
              parentId: finalPage?.parentId,
            });

            console.log(
              "[FileTreeIndex.handleMouseUp] Page moved to root successfully"
            );
          } catch (error) {
            const errorMessage = String(error);
            console.error(
              "[FileTreeIndex.handleMouseUp] Failed to move page:",
              error
            );

            // Silently ignore validation errors (invalid move operations)
            if (
              errorMessage.includes("Cannot move page to itself") ||
              errorMessage.includes("Cannot move page to its own descendant")
            ) {
              console.log(
                "[FileTreeIndex.handleMouseUp] Invalid move operation ignored"
              );
              return;
            }

            // Show alert for actual errors
            alert(`Failed to move page: ${error}`);
          }
        } else if (dragOverPageId && draggedPageId !== dragOverPageId) {
          console.log(
            `[FileTreeIndex.handleMouseUp] Dropping ${draggedPageId} on ${dragOverPageId}`
          );
          console.log("[FileTreeIndex.handleMouseUp] Target page:", {
            id: targetPage?.id,
            title: targetPage?.title,
          });
          console.log(
            "[FileTreeIndex.handleMouseUp] Pages state BEFORE movePage:",
            pages.map((p) => ({
              id: p.id,
              title: p.title,
              parentId: p.parentId,
            }))
          );

          try {
            await movePage(draggedPageId, dragOverPageId);
            console.log(
              "[FileTreeIndex.handleMouseUp] movePage completed, now calling loadPages..."
            );
            await loadPages();
            console.log(
              "[FileTreeIndex.handleMouseUp] loadPages completed, checking final state..."
            );

            const finalPage = usePageStore.getState().pagesById[draggedPageId];
            console.log("[FileTreeIndex.handleMouseUp] Final page state:", {
              id: finalPage?.id,
              title: finalPage?.title,
              parentId: finalPage?.parentId,
            });

            setCollapsed((prev) => ({
              ...prev,
              [dragOverPageId]: false,
            }));
            console.log(
              "[FileTreeIndex.handleMouseUp] Page moved successfully"
            );
          } catch (error) {
            const errorMessage = String(error);
            console.error(
              "[FileTreeIndex.handleMouseUp] Failed to move page:",
              error
            );

            // Silently ignore validation errors (invalid move operations)
            if (
              errorMessage.includes("Cannot move page to itself") ||
              errorMessage.includes("Cannot move page to its own descendant")
            ) {
              console.log(
                "[FileTreeIndex.handleMouseUp] Invalid move operation ignored"
              );
              return;
            }

            // Show alert for actual errors
            alert(`Failed to move page: ${error}`);
          }
        } else {
          console.log(
            "[FileTreeIndex.handleMouseUp] Invalid drop target, no action taken"
          );
        }
      } else {
        console.log(
          "[FileTreeIndex.handleMouseUp] No draggedPageId, no action taken"
        );
      }
    };

    if (dragState.draggedPageId) {
      if (dragState.isDragging) {
        document.body.style.cursor = "grabbing";
      }
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.body.style.cursor = "";
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
          creatingParentId
        );
        const newPageId = await createPage(
          title.trim(),
          creatingParentId || undefined
        );
        console.log("[FileTreeIndex] Page created with ID:", newPageId);

        // Reload pages to update UI
        console.log("[FileTreeIndex] Reloading pages...");
        await loadPages();
        console.log(
          "[FileTreeIndex] Pages reloaded. Total pages:",
          pages.length
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
    [creatingParentId, createPage, loadPages, pages.length]
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
    [pages]
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
      console.log(
        "[FileTreeIndex] handleDeletePage called with pageId:",
        pageId
      );
      const page = pages.find((p) => p.id === pageId);
      if (!page) {
        console.error("[FileTreeIndex] Page not found:", pageId);
        return;
      }

      console.log("[FileTreeIndex] Found page to delete:", {
        id: page.id,
        title: page.title,
        parentId: page.parentId,
      });

      // Log all pages to see the current state
      console.log(
        "[FileTreeIndex] Current pages in store:",
        pages.map((p) => ({
          id: p.id,
          title: p.title,
          parentId: p.parentId,
        }))
      );

      setPageToDelete(page);
      setDeleteModalOpened(true);
    },
    [pages]
  );

  const confirmDeletePage = useCallback(async () => {
    if (!pageToDelete) {
      console.log("[FileTreeIndex] confirmDeletePage: No page to delete");
      return;
    }

    console.log("[FileTreeIndex] confirmDeletePage: Deleting page:", {
      id: pageToDelete.id,
      title: pageToDelete.title,
      parentId: pageToDelete.parentId,
    });

    try {
      console.log(
        "[FileTreeIndex] Calling deletePage with id:",
        pageToDelete.id
      );
      await deletePage(pageToDelete.id);
      console.log("[FileTreeIndex] deletePage completed, reloading pages...");
      await loadPages();
      console.log("[FileTreeIndex] Pages reloaded successfully");
      setDeleteModalOpened(false);
      setPageToDelete(null);
    } catch (error) {
      console.error("[FileTreeIndex] Failed to delete page:", error);
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

    console.log("[FileTreeIndex] Mouse down on:", pageId);

    // Don't prevent default yet - let click events work
    // We'll prevent default only when drag threshold is exceeded

    setDragState({
      isDragging: false, // Not dragging yet, just mouse down
      draggedPageId: pageId,
      dragOverPageId: null,
      startY: e.clientY,
      startX: e.clientX,
      mouseX: e.clientX,
      mouseY: e.clientY,
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
    [pages]
  );

  // Render page tree recursively
  const renderPageTree = useCallback(
    (page: PageData, depth: number): React.ReactNode => {
      const children = pages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      const isCreatingChild = isCreating && creatingParentId === page.id;

      return (
        <React.Fragment key={page.id}>
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
            showIndentGuides={showIndentGuides}
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
      showIndentGuides,
    ]
  );

  const rootPages = useMemo(() => buildTree(null), [buildTree]);

  // Calculate children that will be CASCADE deleted
  const childrenToDelete = useMemo(() => {
    if (!pageToDelete) return [];

    const findAllDescendants = (parentId: string): PageData[] => {
      const directChildren = pages.filter((p) => p.parentId === parentId);
      const allDescendants = [...directChildren];

      for (const child of directChildren) {
        allDescendants.push(...findAllDescendants(child.id));
      }

      return allDescendants;
    };

    const descendants = findAllDescendants(pageToDelete.id);

    console.log(
      "[FileTreeIndex] Children that will be CASCADE deleted:",
      descendants.map((p) => ({
        id: p.id,
        title: p.title,
      }))
    );

    return descendants;
  }, [pageToDelete, pages]);

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

        {/* Dragging Ghost */}
        {dragState.isDragging && dragState.draggedPageId && (
          <div
            style={{
              position: "fixed",
              left: dragState.mouseX + 10,
              top: dragState.mouseY + 10,
              zIndex: 10000,
              pointerEvents: "none",
              backgroundColor: "var(--mantine-color-dark-6)",
              border: "1px solid var(--mantine-color-dark-4)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              opacity: 0.9,
            }}
          >
            <Text size="sm" fw={500}>
              {pages.find((p) => p.id === dragState.draggedPageId)?.title || ""}
            </Text>
          </div>
        )}

        <Stack gap={0} style={{ position: "relative" }}>
          {/* Root Drop Zone */}
          {dragState.isDragging && (
            <div
              data-drop-zone="root"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1000,
                pointerEvents: "all",
                backgroundColor:
                  dragOverPageId === "root"
                    ? "var(--color-interactive-hover)"
                    : "transparent",
                border:
                  dragOverPageId === "root"
                    ? "2px dashed var(--mantine-color-blue-5)"
                    : "2px dashed transparent",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              {dragOverPageId === "root" && (
                <Text size="sm" c="dimmed" fw={500}>
                  Drop here to move to root
                </Text>
              )}
            </div>
          )}

          {/* Pages Tree */}
          <Stack
            gap={0}
            style={{ flex: 1 }}
            onClick={(e) => {
              // Close new page input if clicking on empty space
              if (isCreating && e.target === e.currentTarget) {
                handleCancelCreate();
              }
            }}
          >
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
              <button
                type="button"
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
                  border: "none",
                  background: "none",
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
              </button>
            )}
          </Stack>
        </Stack>
      </ContentWrapper>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setPageToDelete(null);
        }}
        title={t("common.delete_page")}
        centered
        size="md"
      >
        <Stack gap="lg">
          <div>
            <Text
              size="sm"
              mb="xs"
              dangerouslySetInnerHTML={{
                __html: t("common.delete_page_question", {
                  title: pageToDelete?.title || "",
                }),
              }}
            />

            {childrenToDelete.length > 0 && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "var(--mantine-color-yellow-light)",
                  border: "1px solid var(--mantine-color-yellow-outline)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                <Text size="sm" fw={500} c="yellow.9" mb="xs">
                  {t("common.cascade_warning", {
                    count: childrenToDelete.length,
                    plural: childrenToDelete.length > 1 ? "s" : "",
                  })}
                </Text>
                <Stack gap={4}>
                  {childrenToDelete.slice(0, 5).map((child) => (
                    <Text
                      key={child.id}
                      size="xs"
                      c="yellow.9"
                      style={{ paddingLeft: "8px" }}
                    >
                      • {child.title}
                    </Text>
                  ))}
                  {childrenToDelete.length > 5 && (
                    <Text size="xs" c="yellow.9" style={{ paddingLeft: "8px" }}>
                      {t("common.and_more", {
                        count: childrenToDelete.length - 5,
                      })}
                    </Text>
                  )}
                </Stack>
              </div>
            )}
          </div>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                setDeleteModalOpened(false);
                setPageToDelete(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmDeletePage}>
              {childrenToDelete.length > 0
                ? t("common.delete_all", {
                    count: childrenToDelete.length + 1,
                  })
                : t("common.delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageContainer>
  );
}
