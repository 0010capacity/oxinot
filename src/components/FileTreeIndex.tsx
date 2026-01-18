import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import type React from "react";
import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useMemo,
  memo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import {
  type PageData,
  usePageStore,
  usePage,
  usePageChildrenIds,
} from "../stores/pageStore";
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
    prev.page.isDirectory === next.page.isDirectory &&
    prev.childCount === next.childCount &&
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

interface RecursivePageTreeItemProps {
  pageId: string;
  depth: number;
  isCreating: boolean;
  creatingParentId: string | null;
  handleCreatePage: (title: string) => Promise<void>;
  handleCancelCreate: () => void;
  isSubmitting: boolean;
  onEdit: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAddChild: (pageId: string) => void;
  onMouseDown: (e: React.MouseEvent, pageId: string) => void;
  editingPageId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => Promise<void>;
  onEditCancel: () => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (pageId: string) => void;
  draggedPageId: string | null;
  dragOverPageId: string | null;
  showIndentGuides: boolean;
}

const RecursivePageTreeItem = memo((props: RecursivePageTreeItemProps) => {
  const {
    pageId,
    depth,
    isCreating,
    creatingParentId,
    handleCreatePage,
    handleCancelCreate,
    isSubmitting,
    onEdit,
    onDelete,
    onAddChild,
    onMouseDown,
    editingPageId,
    editValue,
    onEditChange,
    onEditSubmit,
    onEditCancel,
    collapsed,
    onToggleCollapse,
    draggedPageId,
    dragOverPageId,
    showIndentGuides,
  } = props;

  const page = usePage(pageId);
  const childrenIds = usePageChildrenIds(pageId);
  const pagesById = usePageStore((state) => state.pagesById);

  const sortedChildrenIds = useMemo(() => {
    return [...childrenIds].sort((a, b) => {
      const titleA = pagesById[a]?.title || "";
      const titleB = pagesById[b]?.title || "";
      return titleA.localeCompare(titleB);
    });
  }, [childrenIds, pagesById]);

  if (!page) return null;

  const hasChildren = sortedChildrenIds.length > 0;
  const isCreatingChild = isCreating && creatingParentId === pageId;

  // Log when creating child for debugging
  if (isCreatingChild) {
    console.log(
      "[RecursivePageTreeItem] Rendering NewPageInput for parent:",
      pageId,
      "depth:",
      depth + 1
    );
  }

  return (
    <MemoizedPageTreeItem
      page={page}
      depth={depth}
      childCount={sortedChildrenIds.length}
      isEditing={editingPageId === pageId}
      onEdit={onEdit}
      onDelete={onDelete}
      onAddChild={onAddChild}
      onMouseDown={onMouseDown}
      editValue={editValue}
      onEditChange={onEditChange}
      onEditSubmit={onEditSubmit}
      onEditCancel={onEditCancel}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      draggedPageId={draggedPageId}
      dragOverPageId={dragOverPageId}
      showIndentGuides={showIndentGuides}
    >
      {hasChildren &&
        sortedChildrenIds.map((childId) => (
          <RecursivePageTreeItem
            key={childId}
            pageId={childId}
            depth={depth + 1}
            isCreating={isCreating}
            creatingParentId={creatingParentId}
            handleCreatePage={handleCreatePage}
            handleCancelCreate={handleCancelCreate}
            isSubmitting={isSubmitting}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onMouseDown={onMouseDown}
            editingPageId={editingPageId}
            editValue={editValue}
            onEditChange={onEditChange}
            onEditSubmit={onEditSubmit}
            onEditCancel={onEditCancel}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            draggedPageId={draggedPageId}
            dragOverPageId={dragOverPageId}
            showIndentGuides={showIndentGuides}
          />
        ))}
      {isCreatingChild && (
        <NewPageInput
          depth={depth + 1}
          onSubmit={handleCreatePage}
          onCancel={handleCancelCreate}
          isSubmitting={isSubmitting}
        />
      )}
    </MemoizedPageTreeItem>
  );
});

RecursivePageTreeItem.displayName = "RecursivePageTreeItem";

export function FileTreeIndex() {
  const { t } = useTranslation();
  const {
    loadPages,
    createPage,
    updatePageTitle,
    deletePage,
    movePage,
    convertToDirectory,
  } = usePageStore();

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

  // Use refs to hold latest values without triggering re-renders
  const pagesRef = useRef(pages);
  const movePageRef = useRef(movePage);
  const loadPagesRef = useRef(loadPages);

  useEffect(() => {
    pagesRef.current = pages;
    movePageRef.current = movePage;
    loadPagesRef.current = loadPages;
  }, [pages, movePage, loadPages]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Mouse-based drag and drop - use callback refs to maintain stable event handlers
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setDragState((prevState) => {
      // Check if we should start dragging (threshold check)
      if (prevState.draggedPageId && !prevState.isDragging) {
        const deltaX = Math.abs(e.clientX - prevState.startX);
        const deltaY = Math.abs(e.clientY - prevState.startY);

        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          return { ...prevState, isDragging: true };
        }
        return prevState;
      }

      if (!prevState.isDragging) return prevState;

      // Prevent text selection while dragging
      e.preventDefault();

      // Find element under cursor
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const pageElement = elements.find((el) =>
        el.getAttribute("data-page-id")
      );
      const dropZone = elements.find(
        (el) => el.getAttribute("data-drop-zone") === "root"
      );

      let dragOverPageId: string | null = null;
      if (pageElement) {
        const pageId = pageElement.getAttribute("data-page-id");
        if (pageId && pageId !== prevState.draggedPageId) {
          dragOverPageId = pageId;
        }
      } else if (dropZone) {
        dragOverPageId = "root";
      }

      // Update mouse position and dragOverPageId
      return {
        ...prevState,
        mouseX: e.clientX,
        mouseY: e.clientY,
        dragOverPageId,
      };
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setDragState((currentState) => {
      const { draggedPageId, dragOverPageId, isDragging } = currentState;

      console.log("[FileTreeIndex.handleMouseUp] Called with:", {
        draggedPageId,
        dragOverPageId,
        isDragging,
      });

      // If we never started dragging (just a click), reset and do nothing
      if (!isDragging) {
        console.log("[FileTreeIndex.handleMouseUp] No drag detected, exiting");
        return {
          isDragging: false,
          draggedPageId: null,
          dragOverPageId: null,
          startY: 0,
          startX: 0,
          mouseX: 0,
          mouseY: 0,
        };
      }

      // Perform drop if valid
      if (draggedPageId) {
        const currentPages = pagesRef.current;
        const draggedPage = currentPages.find((p) => p.id === draggedPageId);
        const targetPage = currentPages.find((p) => p.id === dragOverPageId);

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
            currentPages.map((p) => ({
              id: p.id,
              title: p.title,
              parentId: p.parentId,
            }))
          );

          movePageRef
            .current(draggedPageId, null)
            .then(() => {
              console.log(
                "[FileTreeIndex.handleMouseUp] Page moved to root successfully"
              );

              const finalPage =
                usePageStore.getState().pagesById[draggedPageId];
              console.log("[FileTreeIndex.handleMouseUp] Final page state:", {
                id: finalPage?.id,
                title: finalPage?.title,
                parentId: finalPage?.parentId,
              });
            })
            .catch((error) => {
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
            });
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
            currentPages.map((p) => ({
              id: p.id,
              title: p.title,
              parentId: p.parentId,
            }))
          );

          movePageRef
            .current(draggedPageId, dragOverPageId)
            .then(() => {
              console.log(
                "[FileTreeIndex.handleMouseUp] Page moved successfully"
              );

              const finalPage =
                usePageStore.getState().pagesById[draggedPageId];
              console.log("[FileTreeIndex.handleMouseUp] Final page state:", {
                id: finalPage?.id,
                title: finalPage?.title,
                parentId: finalPage?.parentId,
              });

              setCollapsed((prev) => ({
                ...prev,
                [dragOverPageId]: false,
              }));
            })
            .catch((error) => {
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
            });
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

      // Reset drag state
      return {
        isDragging: false,
        draggedPageId: null,
        dragOverPageId: null,
        startY: 0,
        startX: 0,
        mouseX: 0,
        mouseY: 0,
      };
    });
  }, []);

  useEffect(() => {
    if (!dragState.draggedPageId) {
      document.body.style.cursor = "";
      return;
    }

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
  }, [
    dragState.draggedPageId,
    dragState.isDragging,
    handleMouseMove,
    handleMouseUp,
  ]);

  const handleCreatePage = useCallback<(title: string) => Promise<void>>(
    async (title: string) => {
      if (!title.trim()) {
        console.log("[FileTreeIndex] Empty title, ignoring");
        return;
      }

      setIsSubmitting(true);
      try {
        console.log(
          "[FileTreeIndex] Creating page:",
          title.trim(),
          "parent:",
          creatingParentId
        );

        // If creating a child, ensure parent is a directory first
        if (creatingParentId) {
          const parentPage =
            usePageStore.getState().pagesById[creatingParentId];
          console.log("[FileTreeIndex] Parent page:", parentPage);

          if (parentPage && !parentPage.isDirectory) {
            console.log(
              "[FileTreeIndex] Converting parent to directory:",
              creatingParentId
            );
            try {
              await convertToDirectory(creatingParentId);
              console.log("[FileTreeIndex] Parent converted successfully");
              // Reload pages to get updated parent state
              await loadPages();
              console.log("[FileTreeIndex] Pages reloaded");
            } catch (conversionError) {
              console.error(
                "[FileTreeIndex] Failed to convert parent to directory:",
                conversionError
              );
              throw new Error(
                "Failed to convert parent to directory: " +
                  (conversionError instanceof Error
                    ? conversionError.message
                    : String(conversionError))
              );
            }
          }
        }

        console.log(
          "[FileTreeIndex] Calling createPage with title:",
          title.trim(),
          "parentId:",
          creatingParentId || undefined
        );
        const newPageId = await createPage(
          title.trim(),
          creatingParentId || undefined
        );
        console.log("[FileTreeIndex] Page created with ID:", newPageId);

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
        console.error("[FileTreeIndex] Failed to create page:", error);
        alert(
          "Failed to create page: " +
            (error instanceof Error ? error.message : String(error))
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [creatingParentId, createPage, convertToDirectory, loadPages]
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
      setEditingPageId(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update page:", error);
    }
  }, [editingPageId, editValue, updatePageTitle]);

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
      console.log("[FileTreeIndex] deletePage completed successfully");
      setDeleteModalOpened(false);
      setPageToDelete(null);
    } catch (error) {
      console.error("[FileTreeIndex] Failed to delete page:", error);
      alert(`Failed to delete page: ${error}`);
    }
  }, [pageToDelete, deletePage]);

  const handleAddChild = useCallback((parentId: string) => {
    console.log(
      "[FileTreeIndex] handleAddChild called with parentId:",
      parentId
    );
    setCreatingParentId(parentId);
    setIsCreating(true);

    // Expand parent when adding child
    setCollapsed((prev) => {
      const newCollapsed = {
        ...prev,
        [parentId]: false,
      };
      console.log("[FileTreeIndex] Setting collapsed state:", newCollapsed);
      return newCollapsed;
    });
  }, []);

  const handleToggleCollapse = useCallback((pageId: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, pageId: string) => {
    // Only start drag on left mouse button
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Don't start drag if clicking on action buttons or input fields
    // But allow dragging from the page title text/button area
    if (
      target.tagName === "INPUT" ||
      target.closest("input") ||
      target.closest('[data-action-button="true"]')
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

  const rootChildrenIds = usePageChildrenIds(null);
  const pagesById = usePageStore((state) => state.pagesById);
  const sortedRootPageIds = useMemo(() => {
    return [...rootChildrenIds].sort((a, b) => {
      const titleA = pagesById[a]?.title || "";
      const titleB = pagesById[b]?.title || "";
      return titleA.localeCompare(titleB);
    });
  }, [rootChildrenIds, pagesById]);

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
            {/* New Page Input at bottom */}
            {isCreating && !creatingParentId && (
              <NewPageInput
                depth={0}
                onSubmit={handleCreatePage}
                onCancel={handleCancelCreate}
                isSubmitting={isSubmitting}
              />
            )}
            {sortedRootPageIds.map((pageId) => (
              <RecursivePageTreeItem
                key={pageId}
                pageId={pageId}
                depth={0}
                onEdit={handleEditPage}
                onDelete={handleDeletePage}
                onAddChild={handleAddChild}
                onMouseDown={handleMouseDown}
                editingPageId={editingPageId}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditSubmit={handleEditSubmit}
                onEditCancel={handleEditCancel}
                collapsed={collapsed}
                onToggleCollapse={handleToggleCollapse}
                draggedPageId={draggedPageId}
                dragOverPageId={dragOverPageId}
                showIndentGuides={showIndentGuides}
                isCreating={isCreating}
                creatingParentId={creatingParentId}
                handleCreatePage={handleCreatePage}
                handleCancelCreate={handleCancelCreate}
                isSubmitting={isSubmitting}
              />
            ))}

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
            <Text size="sm" mb="xs">
              {t("common.delete_page_question", {
                title: pageToDelete?.title || "",
              })}
            </Text>

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
