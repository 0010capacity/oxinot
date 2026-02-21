import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { createContext, memo, useEffect, useMemo, useRef } from "react";
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
          className="blocks-list"
          style={{
            fontSize: `${editorFontSize}px`,
            lineHeight: editorLineHeight,
            height: "100%",
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
              <BlockList blocksToShow={blocksToShow} />
            </BlockOrderContext.Provider>
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
