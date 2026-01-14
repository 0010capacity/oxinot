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
  const didAutoCreateInitialBlockForPageRef = useRef<string | null>(null);

  // Make auto-create idempotent while a create request is in-flight for the same page.
  // Without this, multiple renders can trigger duplicate createBlock(null, "") calls
  // resulting in multiple empty root blocks being persisted.
  const isCreatingInitialBlockForPageRef = useRef<string | null>(null);

  // If we auto-create an initial block, force a reload once creation completes to ensure
  // the editor reflects the DB state (some first-open flows can otherwise get stuck
  // showing empty-state even though the file/DB now contains a block).
  const needsReloadAfterInitialCreateRef = useRef(false);

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      // Reset guards when navigating to a different page.
      didAutoCreateInitialBlockForPageRef.current = null;
      isCreatingInitialBlockForPageRef.current = null;
      needsReloadAfterInitialCreateRef.current = false;
      loadPage(pageId);
    }
  }, [pageId, loadPage]);

  // Auto-create first block if page is empty
  useEffect(() => {
    if (!isLoading && !error && pageId && currentPageId === pageId) {
      const rootBlocks = childrenMap.root || [];
      const hasBlocks = rootBlocks.length > 0;

      const alreadyCreatedForThisPage =
        didAutoCreateInitialBlockForPageRef.current === pageId;
      const createInFlightForThisPage =
        isCreatingInitialBlockForPageRef.current === pageId;

      if (
        !hasBlocks &&
        !alreadyCreatedForThisPage &&
        !createInFlightForThisPage
      ) {
        didAutoCreateInitialBlockForPageRef.current = pageId;
        isCreatingInitialBlockForPageRef.current = pageId;
        needsReloadAfterInitialCreateRef.current = true;

        createBlock(null, "")
          .then(() => {
            // Ensure UI catches up with the actual DB state after creation.
            // This avoids first-open empty-state cases when the optimistic block
            // doesn't get reflected in childrenMap for some reason.
            if (needsReloadAfterInitialCreateRef.current) {
              loadPage(pageId);
            }
          })
          .catch((err) => {
            // Allow retry on failure
            didAutoCreateInitialBlockForPageRef.current = null;
            needsReloadAfterInitialCreateRef.current = false;
            console.error("Failed to create initial block:", err);
          })
          .finally(() => {
            // Release in-flight lock
            if (isCreatingInitialBlockForPageRef.current === pageId) {
              isCreatingInitialBlockForPageRef.current = null;
            }
          });
      }
    }
  }, [
    isLoading,
    error,
    pageId,
    currentPageId,
    childrenMap,
    createBlock,
    loadPage,
  ]);

  // Determine which blocks to show based on zoom level
  const blocksToShow = focusedBlockId
    ? [focusedBlockId]
    : childrenMap.root || [];

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

  // blocksToShow is computed above (includes in-flight initial create handling)

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
