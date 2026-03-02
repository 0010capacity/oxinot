import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { createContext, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { usePageStore } from "../stores/pageStore";
import { useRegisterCommands } from "../stores/commandStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";

import { useThemeStore } from "../stores/themeStore";
import { useViewStore } from "../stores/viewStore";
import { showToast } from "../utils/toast";
import { BlockComponent } from "./BlockComponent";
import { ThreadingPath } from "./ThreadingPath";
import "./BlockEditor.css";

export const BlockOrderContext = createContext<string[]>([]);

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

  // Page data for finding child pages
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);

  const zoomPath = useViewStore((state) => state.zoomPath);
  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);
  const showBulletThreading = useOutlinerSettingsStore((s) => s.showBulletThreading);

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

  // Get child page IDs for the current page
  const childPageIds = useMemo(() => {
    return pageIds
      .map((id) => pagesById[id])
      .filter(
        (page) =>
          page && page.parentId === pageId && !page.isDirectory,
      )
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
  }, [currentPageId, pageId, childPageIds, loadSubpageBlocks, clearSubpageBlocks]);

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

  // Drag selection state
  const blocksListRef = useRef<HTMLDivElement>(null);
  const [isDragPending, setIsDragPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5;

  // Refs to track state in event handlers (avoids stale closure issues)
  const isDragPendingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; blockId: string } | null>(null);

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
  const getBlockIdFromPoint = useCallback((x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    const blockRow = element.closest('[data-block-row-id]');
    return blockRow?.getAttribute('data-block-row-id') || null;
  }, []);

  // Handle pointer down - record potential drag start
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('.cm-editor') ||
      target.closest('.block-bullet-wrapper') ||
      target.closest('.collapse-toggle') ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input')
    ) {
      return;
    }

    const blockId = getBlockIdFromPoint(e.clientX, e.clientY);
    if (!blockId) return;

    setIsDragPending(true);
    setDragStart({ x: e.clientX, y: e.clientY, blockId });
    setDragCurrent({ x: e.clientX, y: e.clientY });
  }, [getBlockIdFromPoint]);

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

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start actual drag when threshold is crossed
      if (isDragPendingRef.current && !isDraggingRef.current && distance > DRAG_THRESHOLD) {
        setIsDragging(true);
        setIsDragPending(false);
        useBlockUIStore.getState().setSelectionAnchor(dragStartRef.current.blockId);
        useBlockUIStore.getState().setSelectedBlocks([dragStartRef.current.blockId]);
      }

      if (!isDragPendingRef.current && !isDraggingRef.current) return;

      setDragCurrent({ x: e.clientX, y: e.clientY });

      // Only update block selection when actually dragging (threshold crossed)
      if (!isDraggingRef.current) return;

      const currentBlockId = getBlockIdFromPoint(e.clientX, e.clientY);
      if (currentBlockId && currentBlockId !== dragStartRef.current.blockId) {
        const { selectBlockRange } = useBlockUIStore.getState();
        selectBlockRange(dragStartRef.current.blockId, currentBlockId, blockOrder);
      } else if (currentBlockId === dragStartRef.current.blockId) {
        useBlockUIStore.getState().setSelectedBlocks([dragStartRef.current.blockId]);
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
      if (e.key === 'Escape') {
        setIsDragPending(false);
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        useBlockUIStore.getState().clearSelectedBlocks();
      }
    };

    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
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
            <BlockOrderContext.Provider value={blockOrder}>
              <BlockList rootBlocks={rootBlocks} subpageBlocks={subpageBlocks} />
            </BlockOrderContext.Provider>
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
