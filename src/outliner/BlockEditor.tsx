import { useComputedColorScheme } from "@mantine/core";
import { useEffect, useRef } from "react";
import { LinkedReferences } from "../components/LinkedReferences";
import { SubPagesSection } from "../components/SubPagesSection";
import { ContentWrapper } from "../components/layout/ContentWrapper";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { useBlockStore } from "../stores/blockStore";
import { useThemeStore } from "../stores/themeStore";
import { useViewStore } from "../stores/viewStore";
import { BlockComponent } from "./BlockComponent";
import "./BlockEditor.css";

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

  const loadPage = useBlockStore((state) => state.loadPage);
  const createBlock = useBlockStore((state) => state.createBlock);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  const currentPageId = useBlockStore((state) => state.currentPageId);

  const focusedBlockId = useViewStore((state) => state.focusedBlockId);

  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);

  // Prevent initial block auto-creation from running more than once per page load.
  // This can happen during state transitions (e.g. loadPage sets childrenMap/isLoading in multiple steps),
  // which may cause duplicate empty root blocks to be persisted.
  //
  // IMPORTANT:
  // We must be careful not to "lock out" initial block creation if the page is still empty after load.
  // So we reset this guard after a successful load when the page has no root blocks.
  const didAutoCreateInitialBlockForPageRef = useRef<string | null>(null);

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      // Reset guard when navigating to a different page.
      didAutoCreateInitialBlockForPageRef.current = null;
      loadPage(pageId);
    }
  }, [pageId, loadPage]);

  // Auto-create first block if page is empty
  useEffect(() => {
    if (!isLoading && !error && pageId && currentPageId === pageId) {
      const rootBlocks = childrenMap.root || [];
      const hasBlocks = rootBlocks.length > 0;

      // If load completed and the page is still empty, allow a (single) auto-create attempt.
      // This avoids a scenario where the guard is set during a transient render and we never
      // create the initial block, leaving the editor in an "empty-state" UI.
      if (!hasBlocks) {
        didAutoCreateInitialBlockForPageRef.current = null;
      }

      if (
        !hasBlocks &&
        didAutoCreateInitialBlockForPageRef.current !== pageId
      ) {
        didAutoCreateInitialBlockForPageRef.current = pageId;
        createBlock(null, "").catch((err) => {
          console.error("Failed to create initial block:", err);
        });
      }
    }
  }, [isLoading, error, pageId, currentPageId, childrenMap, createBlock]);

  if (isLoading) {
    return (
      <PageContainer>
        <ContentWrapper>
          <div
            style={{
              padding: "16px",
              opacity: "var(--opacity-dimmed)",
              color: "var(--color-text-tertiary)",
            }}
          >
            Loading...
          </div>
        </ContentWrapper>
      </PageContainer>
    );
  }

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

  // Determine which blocks to show based on zoom level
  const blocksToShow = focusedBlockId
    ? [focusedBlockId]
    : childrenMap.root || [];

  return (
    <PageContainer className={isDark ? "theme-dark" : "theme-light"}>
      <ContentWrapper>
        {/* Breadcrumb */}
        {workspaceName && onNavigateHome && (
          <PageHeader
            showBreadcrumb
            workspaceName={workspaceName}
            pageName={pageName}
            onNavigateHome={onNavigateHome}
          />
        )}

        <div
          className="blocks-list"
          style={{
            fontSize: `${editorFontSize}px`,
            lineHeight: editorLineHeight,
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
            blocksToShow.map((blockId) => (
              <BlockComponent key={blockId} blockId={blockId} depth={0} />
            ))
          )}
        </div>

        {/* Sub Pages */}
        <SubPagesSection currentPageId={pageId} />

        {/* Linked References */}
        <LinkedReferences pageId={pageId} />
      </ContentWrapper>
    </PageContainer>
  );
}
