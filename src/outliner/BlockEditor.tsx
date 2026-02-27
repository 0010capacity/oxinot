import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { createContext, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AIFloatingInput,
  useAIFloatingInput,
} from "../components/AIFloatingInput";
import { LinkedReferences } from "../components/LinkedReferences";
import { SubPagesSection } from "../components/SubPagesSection";
import { ContentWrapper } from "../components/layout/ContentWrapper";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { useBlockEditorCommands } from "../hooks/useBlockEditorCommands";
import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { useRegisterCommands } from "../stores/commandStore";

import { useThemeStore } from "../stores/themeStore";
import { useViewStore } from "../stores/viewStore";
import { showToast } from "../utils/toast";
import { BlockComponent } from "./BlockComponent";
import "./BlockEditor.css";

export const BlockOrderContext = createContext<string[]>([]);

interface BlockListProps {
  blocksToShow: string[];
}

const BlockList = memo(function BlockList({ blocksToShow }: BlockListProps) {
  const blocks = useMemo(
    () =>
      blocksToShow.map((blockId: string) => (
        <BlockComponent key={blockId} blockId={blockId} depth={0} />
      )),
    [blocksToShow],
  );

  return <>{blocks}</>;
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
  const currentPageId = useBlockStore((state) => state.currentPageId);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  const blocksById = useBlockStore((state) => state.blocksById);

  const zoomPath = useViewStore((state) => state.zoomPath);
  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);

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
  const blocksToShow = useMemo(() => {
    let toShow: string[] = [];

    if (zoomPath.length > 0) {
      const zoomRootId = zoomPath[zoomPath.length - 1];
      if (zoomRootId && blocksById[zoomRootId]) {
        toShow = [zoomRootId];
      } else {
        toShow = [];
      }
    } else {
      toShow = childrenMap.root || [];
    }

    if (
      blocksToShowRef.current.length !== toShow.length ||
      !blocksToShowRef.current.every(
        (id: string, i: number) => id === toShow[i],
      )
    ) {
      blocksToShowRef.current = toShow;
    }
    return blocksToShowRef.current;
  }, [zoomPath, childrenMap, blocksById]);

  const blockOrder = useMemo(() => {
    const memoComputeStart = performance.now();
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
    const memoComputeTime = performance.now() - memoComputeStart;
    console.log(
      `[BlockEditor:timing] useMemo blockOrder computed in ${memoComputeTime.toFixed(
        2,
      )}ms (${computed.length} visible blocks)`,
    );
    return computed;
  }, [blocksToShow, blocksById, childrenMap]);

  // Drag selection state
  const blocksListRef = useRef<HTMLDivElement>(null);
  const [isDragPending, setIsDragPending] = useState(false); // Potential drag started
  const [isDragging, setIsDragging] = useState(false); // Actual drag in progress
  const [dragStart, setDragStart] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5; // Minimum pixels to move before considering it a drag

  // Get block ID from element under cursor
  const getBlockIdFromPoint = useCallback((x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    const blockRow = element.closest('[data-block-row-id]');
    return blockRow?.getAttribute('data-block-row-id') || null;
  }, []);

  // Handle pointer down - record potential drag start
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start on left click
    if (e.button !== 0) return;
    
    // Don't start if clicking inside CodeMirror editor or on interactive elements
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

    // Record potential drag start (don't select yet)
    setIsDragPending(true);
    setDragStart({ x: e.clientX, y: e.clientY, blockId });
    setDragCurrent({ x: e.clientX, y: e.clientY });
  }, [getBlockIdFromPoint]);



  // Use document-level listeners for reliable drag handling
  useEffect(() => {
    if (!isDragPending && !isDragging) return;

    const onPointerUp = () => {
      // If click without drag, clear any existing selection
      if (isDragPending && !isDragging) {
        useBlockUIStore.getState().clearSelectedBlocks();
        useBlockUIStore.getState().clearSelectionAnchor();
      }
      setIsDragPending(false);
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStart) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start actual drag when threshold is crossed
      if (isDragPending && !isDragging && distance > DRAG_THRESHOLD) {
        setIsDragging(true);
        setIsDragPending(false);
        useBlockUIStore.getState().setSelectionAnchor(dragStart.blockId);
        useBlockUIStore.getState().setSelectedBlocks([dragStart.blockId]);
      }

      if (!isDragging && distance <= DRAG_THRESHOLD) return;

      setDragCurrent({ x: e.clientX, y: e.clientY });

      const currentBlockId = getBlockIdFromPoint(e.clientX, e.clientY);
      if (currentBlockId && currentBlockId !== dragStart.blockId) {
        const { selectBlockRange } = useBlockUIStore.getState();
        selectBlockRange(dragStart.blockId, currentBlockId, blockOrder);
      } else if (currentBlockId === dragStart.blockId) {
        useBlockUIStore.getState().setSelectedBlocks([dragStart.blockId]);
      }
    };

    const onPointerCancel = () => {
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
  }, [isDragPending, isDragging, dragStart, getBlockIdFromPoint, blockOrder]);

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
    <PageContainer className={isDark ? "theme-dark" : "theme-light"}>
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
          className="blocks-list"
          style={{
            fontSize: `${editorFontSize}px`,
            lineHeight: editorLineHeight,
            height: "100%",
            userSelect: isDragging ? "none" : undefined,
          }}
          onPointerDown={handlePointerDown}
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
              <BlockList blocksToShow={blocksToShow} />
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
                zIndex: 1000,
              }}
            />
          )}
        </div>

        <SubPagesSection currentPageId={pageId} />

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
