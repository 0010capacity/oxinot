import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import {
  type PageData,
  usePage,
  usePageChildrenIds,
  usePageStore,
} from "../stores/pageStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { NewPageInput } from "./fileTree/NewPageInput";
import { PageTreeItem } from "./fileTree/PageTreeItem";
import { ContentWrapper } from "./layout/ContentWrapper";
import { PageContainer } from "./layout/PageContainer";
import { PageHeader } from "./layout/PageHeader";

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
    prev.dragOverPageId === next.dragOverPageId &&
    prev.showIndentGuides === next.showIndentGuides &&
    prev.isCreating === next.isCreating &&
    prev.creatingParentId === next.creatingParentId &&
    prev.isSubmitting === next.isSubmitting
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
  editingPageId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => Promise<void>;
  onEditCancel: () => void;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (pageId: string) => void;
  dragOverPageId: string | null;
  showIndentGuides: boolean;
}

const RecursivePageTreeItem = memo(
  (props: RecursivePageTreeItemProps) => {
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
      editingPageId,
      editValue,
      onEditChange,
      onEditSubmit,
      onEditCancel,
      collapsed,
      onToggleCollapse,
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

    return (
      <MemoizedPageTreeItem
        page={page}
        depth={depth}
        childCount={sortedChildrenIds.length}
        isEditing={editingPageId === pageId}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        editValue={editValue}
        onEditChange={onEditChange}
        onEditSubmit={onEditSubmit}
        onEditCancel={onEditCancel}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        dragOverPageId={dragOverPageId}
        showIndentGuides={showIndentGuides}
        isCreating={isCreating}
        creatingParentId={creatingParentId}
        isSubmitting={isSubmitting}
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
              editingPageId={editingPageId}
              editValue={editValue}
              onEditChange={onEditChange}
              onEditSubmit={onEditSubmit}
              onEditCancel={onEditCancel}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
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
  },
  (prev, next) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prev.pageId === next.pageId &&
      prev.depth === next.depth &&
      prev.isCreating === next.isCreating &&
      prev.creatingParentId === next.creatingParentId &&
      prev.isSubmitting === next.isSubmitting &&
      prev.editingPageId === next.editingPageId &&
      prev.editValue === next.editValue &&
      prev.collapsed[prev.pageId] === next.collapsed[next.pageId] &&
      prev.dragOverPageId === next.dragOverPageId &&
      prev.showIndentGuides === next.showIndentGuides
    );
  },
);

RecursivePageTreeItem.displayName = "RecursivePageTreeItem";

// Helper to get all page IDs in a flat array for SortableContext
function getAllPageIds(
  parentId: string | null,
  pagesById: Record<string, PageData>,
): string[] {
  const result: string[] = [];
  const children = Object.values(pagesById)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.title.localeCompare(b.title));

  for (const child of children) {
    result.push(child.id);
    result.push(...getAllPageIds(child.id, pagesById));
  }
  return result;
}

export function FileTreeIndex() {
  const { t } = useTranslation();
  const {
    loadPages,
    createPage,
    updatePageTitle,
    deletePageRecursive,
    movePage,
    convertToDirectory,
  } = usePageStore();

  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const workspaceName = workspacePath?.split("/").pop() || "Workspace";
  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides,
  );

  // Use single selector to ensure atomic updates
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]).filter(Boolean),
  );
  const pagesById = usePageStore((state) => state.pagesById);

  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // DnD state for tracking active drag
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageData | null>(null);

  // Use refs to hold latest values without triggering re-renders
  const movePageRef = useRef(movePage);

  useEffect(() => {
    movePageRef.current = movePage;
  }, [movePage]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Configure pointer sensor with drag threshold to distinguish from click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px threshold to distinguish drag from click
      },
    }),
  );

  // Get all page IDs for SortableContext
  const allPageIds = useMemo(() => getAllPageIds(null, pagesById), [pagesById]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActivePageId(event.active.id as string);
  }, []);

  // Handle drag over (for drop zone highlighting)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      setDragOverPageId(over.id as string);
    } else {
      setDragOverPageId(null);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActivePageId(null);
      setDragOverPageId(null);

      if (!over || active.id === over.id) return;

      const draggedId = active.id as string;
      const targetId = over.id as string;
      // Move the page to be a child of the target (or root if target is "root")

      try {
        // Move the page to be a child of the target (or root if target is "root")
        if (targetId === "root") {
          await movePageRef.current(draggedId, null);
        } else {
          await movePageRef.current(draggedId, targetId);
          // Expand the target folder after drop
          setCollapsed((prev) => ({
            ...prev,
            [targetId]: false,
          }));
        }
      } catch (error) {
        const errorMessage = String(error);
        console.error(
          "[FileTreeIndex.handleDragEnd] Failed to move page:",
          error,
        );

        // Silently ignore validation errors (invalid move operations)
        if (
          errorMessage.includes("Cannot move page to itself") ||
          errorMessage.includes("Cannot move page to its own descendant")
        ) {
          return;
        }

        // Show notification for actual errors
        notifications.show({
          color: "red",
          title: "Error",
          message: `Failed to move page: ${error}`,
        });
      }
    },
    [],
  );

  const handleCreatePage = useCallback<(title: string) => Promise<void>>(
    async (title: string) => {
      if (!title.trim()) {
        setIsCreating(false);
        setCreatingParentId(null);
        return;
      }

      setIsSubmitting(true);
      try {
        // If creating a child, ensure parent is a directory first
        if (creatingParentId) {
          const parentPage =
            usePageStore.getState().pagesById[creatingParentId];

          if (parentPage && !parentPage.isDirectory) {
            try {
              await convertToDirectory(creatingParentId);
            } catch (conversionError) {
              console.error(
                "[FileTreeIndex] Failed to convert parent to directory:",
                conversionError,
              );
              setIsSubmitting(false);
              notifications.show({
                color: "red",
                title: "Error",
                message: `Failed to convert parent to directory: ${
                  conversionError instanceof Error
                    ? conversionError.message
                    : String(conversionError)
                }`,
              });
              return;
            }
          }
        }

        await createPage(title.trim(), creatingParentId || undefined);

        // Clean up state immediately
        setIsCreating(false);
        setCreatingParentId(null);
        setIsSubmitting(false);

        // Expand parent if creating child
        if (creatingParentId) {
          setCollapsed((prev) => ({
            ...prev,
            [creatingParentId]: false,
          }));
        }
      } catch (error) {
        console.error("[FileTreeIndex] Failed to create page:", error);
        setIsSubmitting(false);
        setIsCreating(false);
        setCreatingParentId(null);
        notifications.show({
          color: "red",
          title: "Error",
          message: `Failed to create page: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    },
    [creatingParentId, createPage, convertToDirectory],
  );

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setCreatingParentId(null);
    setIsSubmitting(false);
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
      const page = pages.find((p) => p.id === pageId);
      if (!page) {
        console.error("[FileTreeIndex] Page not found:", pageId);
        return;
      }

      setPageToDelete(page);
      setDeleteModalOpened(true);
    },
    [pages],
  );

  const confirmDeletePage = useCallback(async () => {
    if (!pageToDelete) {
      return;
    }

    try {
      await deletePageRecursive(pageToDelete.id);
      setDeleteModalOpened(false);
      setPageToDelete(null);
    } catch (error) {
      console.error("[FileTreeIndex] Failed to delete page:", error);
      notifications.show({
        color: "red",
        title: "Error",
        message: `Failed to delete page: ${error}`,
      });
    }
  }, [pageToDelete, deletePageRecursive]);

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

  const rootChildrenIds = usePageChildrenIds(null);
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
      })),
    );

    return descendants;
  }, [pageToDelete, pages]);

  // Get active page for DragOverlay
  const activePage = activePageId ? pagesById[activePageId] : null;

  return (
    <PageContainer>
      <ContentWrapper>
        {/* Workspace Title */}
        <PageHeader title={workspaceName} />

        <Stack gap={0} style={{ position: "relative" }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={allPageIds}
              strategy={verticalListSortingStrategy}
            >
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
                    editingPageId={editingPageId}
                    editValue={editValue}
                    onEditChange={setEditValue}
                    onEditSubmit={handleEditSubmit}
                    onEditCancel={handleEditCancel}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
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
            </SortableContext>

            {/* Drag Overlay - shows preview while dragging */}
            <DragOverlay>
              {activePage ? (
                <div
                  style={{
                    opacity: 0.9,
                    padding: "8px 12px",
                    backgroundColor: "var(--color-bg-secondary)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border-primary)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <Text size="sm" fw={500}>
                    {activePage.title}
                  </Text>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

export default FileTreeIndex;
