import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
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
import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import {
  createContext,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AIFloatingInput,
  useAIFloatingInput,
} from "../components/AIFloatingInput";
import { LinkedReferences } from "../components/LinkedReferences";
import { ContentWrapper } from "../components/layout/ContentWrapper";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { useBlockEditorCommands } from "../hooks/useBlockEditorCommands";
import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { useRegisterCommands } from "../stores/commandStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { usePageStore } from "../stores/pageStore";
import { useThemeStore } from "../stores/themeStore";
import { useViewStore } from "../stores/viewStore";
import { showToast } from "../utils/toast";
import { BlockComponent } from "./BlockComponent";
import { ThreadingPath } from "./ThreadingPath";
import "./BlockEditor.css";

export const BlockOrderContext = createContext<string[]>([]);

// Drop position type for drag-and-drop indicators
export type DropPosition = "before" | "child" | "after" | null;

export const DragOverPositionContext = createContext<{
  overBlockId: string | null;
  dropPosition: DropPosition;
}>({
  overBlockId: null,
  dropPosition: null,
});
interface BlockListProps {
  rootBlocks: string[];
  subpageBlocks: string[];
}

const BlockList = memo(function BlockList({
  rootBlocks,
  subpageBlocks,
}: BlockListProps) {
  const rootBlockElements = useMemo(
    () =>
      rootBlocks.map((blockId: string) => (
        <BlockComponent key={blockId} blockId={blockId} depth={0} />
      )),
    [rootBlocks],
  );

  const subpageBlockElements = useMemo(
    () =>
      subpageBlocks.map((blockId: string) => (
        <BlockComponent key={blockId} blockId={blockId} depth={0} />
      )),
    [subpageBlocks],
  );

  const hasSubpages = subpageBlocks.length > 0;

  return (
    <>
      {rootBlockElements}
      {hasSubpages && (
        <div className="subpages-divider">
          <div className="subpages-divider-line" />
        </div>
      )}
      {subpageBlockElements}
    </>
  );
});

interface BlockEditorProps {
  pageId: string;
  workspaceName?: string;
  pageName?: string;
  onNavigateHome?: () => void;
}

export function BlockEditor({
  pageId,
  workspaceName,
  pageName,
  onNavigateHome,
}: BlockEditorProps) {
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  const openPage = useBlockStore((state) => state.openPage);
  const loadSubpageBlocks = useBlockStore((state) => state.loadSubpageBlocks);
  const clearSubpageBlocks = useBlockStore((state) => state.clearSubpageBlocks);
  const currentPageId = useBlockStore((state) => state.currentPageId);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  const blocksById = useBlockStore((state) => state.blocksById);
  const moveBlock = useBlockStore((state) => state.moveBlock);

  // Page data for finding child pages
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);

  const zoomPath = useViewStore((state) => state.zoomPath);
  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);
  const showBulletThreading = useOutlinerSettingsStore(
    (s) => s.showBulletThreading,
  );

  const aiFloatingInput = useAIFloatingInput();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        const focusedBlockId = useBlockUIStore.getState().focusedBlockId;
        const selectedBlockIds = useBlockUIStore.getState().selectedBlockIds;
        const targetBlockIds =
          selectedBlockIds.length > 0
            ? selectedBlockIds
            : focusedBlockId
              ? [focusedBlockId]
              : [];
        if (targetBlockIds.length > 0) {
          aiFloatingInput.open(targetBlockIds);
        }
      }
    };

    const handleAIEditEvent = (e: CustomEvent<{ blockIds: string[] }>) => {
      aiFloatingInput.open(e.detail.blockIds);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(
      "ai-edit-blocks",
      handleAIEditEvent as EventListener,
    );
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(
        "ai-edit-blocks",
        handleAIEditEvent as EventListener,
      );
    };
  }, [aiFloatingInput]);

  // Register page-level command
  useRegisterCommands(
    useMemo(
      () => [
        {
          id: `copy-link-${pageId}`,
          label: `Copy link to [[${pageName || pageId}]]`,
          description: "Copy wiki-link to clipboard",
          icon: <IconCopy size={16} />,
          action: () => {
            navigator.clipboard.writeText(`[[${pageName || pageId}]]`);
            showToast({ message: "Link copied to clipboard", type: "success" });
          },
          category: "Page",
          keywords: ["copy", "link", "wiki"],
        },
      ],
      [pageId, pageName],
    ),
  );

  // Register block editor commands
  useBlockEditorCommands({
    onClose: undefined,
  });

  useEffect(() => {
    if (pageId && currentPageId !== pageId) {
      openPage(pageId);
    }
  }, [pageId, currentPageId, openPage]);

  // Get child page IDs for the current page (including folder notes)
  const childPageIds = useMemo(() => {
    return pageIds
      .map((id) => pagesById[id])
      .filter((page) => page && page.parentId === pageId)
      .map((page) => page.id);
  }, [pageIds, pagesById, pageId]);

  // Load subpage blocks when main page is loaded
  useEffect(() => {
    if (currentPageId === pageId && childPageIds.length > 0) {
      loadSubpageBlocks(childPageIds);
    }
    return () => {
      clearSubpageBlocks();
    };
  }, [
    currentPageId,
    pageId,
    childPageIds,
    loadSubpageBlocks,
    clearSubpageBlocks,
  ]);

  const clearZoom = useViewStore((state) => state.clearZoom);
  const zoomByPageId = useViewStore((state) => state.zoomByPageId);
  const hasRestoredZoomRef = useRef(false);

  useEffect(() => {
    if (
      pageId &&
      currentPageId === pageId &&
      Object.keys(blocksById).length > 0
    ) {
      const savedZoom = zoomByPageId[pageId];
      const currentZoom = useViewStore.getState().zoomPath;

      if (currentZoom.length === 0 && savedZoom && savedZoom.length > 0) {
        const lastZoomId = savedZoom[savedZoom.length - 1];
        if (blocksById[lastZoomId]) {
          useViewStore.setState({ zoomPath: [...savedZoom] });
          hasRestoredZoomRef.current = true;
        }
      }
    }
  }, [pageId, currentPageId, blocksById, zoomByPageId]);

  useEffect(() => {
    if (zoomPath.length > 0) {
      const zoomRootId = zoomPath[zoomPath.length - 1];
      if (!blocksById[zoomRootId]) {
        if (!hasRestoredZoomRef.current) {
          console.warn(
            `[BlockEditor] Zoom target ${zoomRootId} not found in blocksById, clearing zoom`,
          );
          clearZoom();
        } else {
          hasRestoredZoomRef.current = false;
        }
      }
    }
  }, [zoomPath, blocksById, clearZoom]);

  const blocksToShowRef = useRef<string[]>([]);
  const rootBlocks = useMemo(() => {
    if (zoomPath.length > 0) {
      const zoomRootId = zoomPath[zoomPath.length - 1];
      if (zoomRootId && blocksById[zoomRootId]) {
        if (zoomRootId.startsWith("subpage-header:")) {
          return [];
        }
        return [zoomRootId];
      }
      return [];
    }
    return childrenMap.root || [];
  }, [zoomPath, childrenMap, blocksById]);

  const subpageBlocks = useMemo(() => {
    if (zoomPath.length > 0) {
      return [];
    }
    return childrenMap.subpages || [];
  }, [zoomPath, childrenMap]);

  const blocksToShow = useMemo(() => {
    const toShow = [...rootBlocks, ...subpageBlocks];
    if (
      blocksToShowRef.current.length !== toShow.length ||
      !blocksToShowRef.current.every(
        (id: string, i: number) => id === toShow[i],
      )
    ) {
      blocksToShowRef.current = toShow;
    }
    return blocksToShowRef.current;
  }, [rootBlocks, subpageBlocks]);

  const blockOrder = useMemo(() => {
    const getAllVisibleBlocks = (blockIds: string[]): string[] => {
      const result: string[] = [];
      for (const blockId of blockIds) {
        result.push(blockId);
        const block = blocksById[blockId];
        const children = childrenMap[blockId];
        if (block && children && children.length > 0 && !block.isCollapsed) {
          result.push(...getAllVisibleBlocks(children));
        }
      }
      return result;
    };
    const computed = getAllVisibleBlocks(blocksToShow);
    return computed;
  }, [blocksToShow, blocksById, childrenMap]);

  // DnD state for block reordering
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    overBlockId: string | null;
    dropPosition: DropPosition;
  }>({
    overBlockId: null,
    dropPosition: null,
  });
  // Track current over block id during drag (for global pointer move handler)
  const dragOverBlockIdRef = useRef<string | null>(null);
  // Global pointer move handler ref
  const globalPointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);

  // Configure pointer sensor with drag threshold to distinguish from click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px threshold to distinguish drag from click
      },
    }),
  );

  // Calculate drop position based on cursor Y position relative to the over element
  const getDropPosition = useCallback(
    (overId: string, cursorY: number): DropPosition => {
      const element = document.querySelector(
        `[data-block-row-id="${overId}"]`,
      );
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const relativeY = cursorY - rect.top;
      const height = rect.height;

      // Use percentage-based thresholds for drop zones
      // Top 30%: before, Bottom 30%: after, Middle 40%: child
      const beforeThreshold = height * 0.3;
      const afterThreshold = height * 0.7;

      if (relativeY < beforeThreshold) {
        return "before";
      }
      if (relativeY > afterThreshold) {
        return "after";
      }
      return "child";
    },
    [],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
      setActiveBlockId(event.active.id as string);
      setDragOverInfo({ overBlockId: null, dropPosition: null });
      dragOverBlockIdRef.current = null;

      // Add global pointer move listener to track mouse position during drag
      // This is needed because @dnd-kit captures pointer events
      const handleGlobalPointerMove = (e: PointerEvent) => {
        const overId = dragOverBlockIdRef.current;
        if (overId) {
          const dropPosition = getDropPosition(overId, e.clientY);
          setDragOverInfo((prev) => {
            if (prev.overBlockId === overId && prev.dropPosition === dropPosition) {
              return prev;
            }
            return { overBlockId: overId, dropPosition };
          });
        }
      };
      globalPointerMoveRef.current = handleGlobalPointerMove;
      document.addEventListener("pointermove", handleGlobalPointerMove);
    },
    [getDropPosition],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event;
      if (!over || over.id === activeBlockId) {
        dragOverBlockIdRef.current = null;
        setDragOverInfo({ overBlockId: null, dropPosition: null });
        return;
      }
      // Update the ref - the global pointer move handler will update the state
      dragOverBlockIdRef.current = over.id as string;
    },
    [activeBlockId],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const currentDragOverInfo = { ...dragOverInfo };
      setActiveBlockId(null);
      setDragOverInfo({ overBlockId: null, dropPosition: null });
      dragOverBlockIdRef.current = null;

      // Remove global pointer move listener
      if (globalPointerMoveRef.current) {
        document.removeEventListener("pointermove", globalPointerMoveRef.current);
        globalPointerMoveRef.current = null;
      }

      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the position in blockOrder
      const overIndex = blockOrder.indexOf(overId);
      const activeIndex = blockOrder.indexOf(activeId);

      if (overIndex === -1 || activeIndex === -1) return;

      // Determine new parent and position
      const activeBlock = blocksById[activeId];
      const overBlock = blocksById[overId];

      if (!activeBlock || !overBlock) return;

      // Prevent dropping onto self or descendants (circular reference)
      const isDescendant = (parentId: string, childId: string): boolean => {
        const children = childrenMap[parentId] || [];
        if (children.includes(childId)) return true;
        for (const child of children) {
          if (isDescendant(child, childId)) return true;
        }
        return false;
      };

      if (isDescendant(activeId, overId)) {
        showToast({
          message: "Cannot drop block onto its own descendant",
          type: "error",
        });
        return;
      }

      // Determine new parent and afterBlockId based on drop position
      let newParentId: string | null;
      let afterBlockId: string | null = null;

      const dropPosition = currentDragOverInfo.dropPosition || "after";

      if (dropPosition === "child") {
        // Drop as a child of the over block (at the end)
        newParentId = overId;
        const overChildren = childrenMap[overId] || [];
        afterBlockId =
          overChildren.length > 0
            ? overChildren[overChildren.length - 1]
            : null;
      } else {
        // Drop as a sibling of the over block
        newParentId = overBlock.parentId;

        if (dropPosition === "before") {
          // Place before the over block
          const overSiblings = newParentId
            ? childrenMap[newParentId] || []
            : childrenMap.root || [];
          const overSiblingIndex = overSiblings.indexOf(overId);
          if (overSiblingIndex > 0) {
            afterBlockId = overSiblings[overSiblingIndex - 1];
          }
          // If overSiblingIndex === 0, afterBlockId stays null (move to first position)
        } else {
          // Place after the over block
          afterBlockId = overId;
        }
      }

      try {
        await moveBlock(activeId, newParentId, afterBlockId);
      } catch (error) {
        console.error("[BlockEditor] Failed to move block:", error);
        showToast({ message: "Failed to move block", type: "error" });
      }
    },
    [blockOrder, blocksById, childrenMap, moveBlock, dragOverInfo],
  );

  // Drag selection state
  const blocksListRef = useRef<HTMLDivElement>(null);
  const [isDragPending, setIsDragPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    blockId: string;
  } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const DRAG_THRESHOLD = 5;

  // Refs to track state in event handlers (avoids stale closure issues)
  const isDragPendingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; blockId: string } | null>(
    null,
  );

  // Keep refs in sync with state
  useEffect(() => {
    isDragPendingRef.current = isDragPending;
  }, [isDragPending]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  useEffect(() => {
    dragStartRef.current = dragStart;
  }, [dragStart]);

  // Get block ID from element under cursor
  const getBlockIdFromPoint = useCallback(
    (x: number, y: number): string | null => {
      const element = document.elementFromPoint(x, y);
      if (!element) return null;
      const blockRow = element.closest("[data-block-row-id]");
      return blockRow?.getAttribute("data-block-row-id") || null;
    },
    [],
  );

  // Check if modifier key for block selection is held (Cmd on Mac, Ctrl on others)
  const isBlockSelectionModifier = useCallback(
    (e: React.PointerEvent | PointerEvent): boolean => {
      // macOS uses metaKey (Cmd), others use ctrlKey
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      return isMac ? e.metaKey : e.ctrlKey;
    },
    [],
  );

  // Handle pointer down - record potential drag start (only with modifier key)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      // Require modifier key for block selection (Cmd on Mac, Ctrl on others)
      if (!isBlockSelectionModifier(e)) return;

      const target = e.target as HTMLElement;
      if (
        target.closest(".cm-editor") ||
        target.closest(".block-bullet-wrapper") ||
        target.closest(".collapse-toggle") ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest("input")
      ) {
        return;
      }

      const blockId = getBlockIdFromPoint(e.clientX, e.clientY);
      if (!blockId) return;

      // Prevent text selection while block-selecting
      e.preventDefault();

      setIsDragPending(true);
      setDragStart({ x: e.clientX, y: e.clientY, blockId });
      setDragCurrent({ x: e.clientX, y: e.clientY });
    },
    [getBlockIdFromPoint, isBlockSelectionModifier],
  );

  // Stable document-level listeners (registered once)
  useEffect(() => {
    const onPointerUp = () => {
      // Immediately clear refs to prevent stale state in subsequent pointermove events
      isDragPendingRef.current = false;
      isDraggingRef.current = false;
      dragStartRef.current = null;
      // If click without drag, clear any existing selection
      setIsDragPending(false);
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;

      // Cancel block selection if modifier key was released
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierHeld = isMac ? e.metaKey : e.ctrlKey;
      if (!modifierHeld) {
        // Modifier released - cancel selection
        isDragPendingRef.current = false;
        isDraggingRef.current = false;
        dragStartRef.current = null;
        setIsDragPending(false);
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        return;
      }

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start actual drag when threshold is crossed
      if (
        isDragPendingRef.current &&
        !isDraggingRef.current &&
        distance > DRAG_THRESHOLD
      ) {
        setIsDragging(true);
        setIsDragPending(false);
        useBlockUIStore
          .getState()
          .setSelectionAnchor(dragStartRef.current.blockId);
        useBlockUIStore
          .getState()
          .setSelectedBlocks([dragStartRef.current.blockId]);
      }

      if (!isDragPendingRef.current && !isDraggingRef.current) return;

      setDragCurrent({ x: e.clientX, y: e.clientY });

      // Only update block selection when actually dragging (threshold crossed)
      if (!isDraggingRef.current) return;

      const currentBlockId = getBlockIdFromPoint(e.clientX, e.clientY);
      if (currentBlockId && currentBlockId !== dragStartRef.current.blockId) {
        const { selectBlockRange } = useBlockUIStore.getState();
        selectBlockRange(
          dragStartRef.current.blockId,
          currentBlockId,
          blockOrder,
        );
      } else if (currentBlockId === dragStartRef.current.blockId) {
        useBlockUIStore
          .getState()
          .setSelectedBlocks([dragStartRef.current.blockId]);
      }
    };

    const onPointerCancel = () => {
      isDragPendingRef.current = false;
      isDraggingRef.current = false;
      dragStartRef.current = null;
      setIsDragPending(false);
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDragPending(false);
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        useBlockUIStore.getState().clearSelectedBlocks();
      }
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [blockOrder, getBlockIdFromPoint]);

  // Calculate selection rectangle for visual feedback
  const selectionRect = useMemo(() => {
    if (!isDragging || !dragStart || !dragCurrent) return null;

    const left = Math.min(dragStart.x, dragCurrent.x);
    const top = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    return { left, top, width, height };
  }, [isDragging, dragStart, dragCurrent]);

  if (error) {
    return (
      <PageContainer>
        <ContentWrapper>
          <div style={{ padding: "16px", color: "var(--color-error)" }}>
            Error: {error}
          </div>
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      className={isDark ? "theme-dark" : "theme-light"}
      onPointerDownCapture={(e: React.PointerEvent) => {
        // Clear block focus when clicking outside blocks-list
        // (e.g., page header, linked references, empty content area).
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (!target.closest(".blocks-list")) {
          useBlockUIStore.getState().clearSelectedBlocks();
          useBlockUIStore.getState().clearSelectionAnchor();
          useBlockUIStore.getState().setFocusedBlock(null);
        }
      }}
    >
      <ContentWrapper>
        {workspaceName && onNavigateHome && (
          <PageHeader
            showBreadcrumb
            workspaceName={workspaceName}
            onNavigateHome={onNavigateHome}
          />
        )}

        <div
          ref={blocksListRef}
          className={`blocks-list${showBulletThreading ? " bullet-threading" : ""}`}
          style={{
            fontSize: `${editorFontSize}px`,
            lineHeight: editorLineHeight,
            height: "100%",
            userSelect: isDragging ? "none" : undefined,
          }}
          onPointerDown={handlePointerDown}
          onPointerDownCapture={(e: React.PointerEvent) => {
            // Capture phase: clear focus BEFORE blur/click synthesis.
            // On macOS trackpad, light taps fire pointerdown but may skip click,
            // which would leave isFocused=true while CodeMirror lost DOM focus.
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (
              !target.closest("[data-block-row-id]") &&
              !target.closest(".empty-state")
            ) {
              useBlockUIStore.getState().clearSelectedBlocks();
              useBlockUIStore.getState().clearSelectionAnchor();
              useBlockUIStore.getState().setFocusedBlock(null);
            }
          }}
        >
          {blocksToShow.length === 0 ? (
            <div className="empty-state">
              <div
                style={{ opacity: "var(--opacity-dimmed)", padding: "20px" }}
              >
                Start typing to create your first block...
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blockOrder}
                strategy={verticalListSortingStrategy}
              >
                <BlockOrderContext.Provider value={blockOrder}>
                  <DragOverPositionContext.Provider value={dragOverInfo}>
                    <BlockList
                      rootBlocks={rootBlocks}
                      subpageBlocks={subpageBlocks}
                    />
                  </DragOverPositionContext.Provider>
                </BlockOrderContext.Provider>
              </SortableContext>
              <DragOverlay>
                {activeBlockId ? (
                  <div
                    style={{
                      opacity: 0.8,
                      padding: "4px 8px",
                      backgroundColor: "var(--color-bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border-primary)",
                    }}
                  >
                    {blocksById[activeBlockId]?.content?.slice(0, 50) ||
                      "Block"}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Selection rectangle overlay */}
          {selectionRect && (
            <div
              style={{
                position: "fixed",
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
                height: selectionRect.height,
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.5)",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Threading path visualization */}
          {showBulletThreading && <ThreadingPath />}
        </div>

        <LinkedReferences pageId={pageId} />
      </ContentWrapper>

      {aiFloatingInput.state?.isOpen && (
        <AIFloatingInput
          blockIds={aiFloatingInput.state.blockIds}
          position={aiFloatingInput.state.position}
          mode={aiFloatingInput.state.mode}
          onClose={aiFloatingInput.close}
        />
      )}
    </PageContainer>
  );
}

export default BlockEditor;
