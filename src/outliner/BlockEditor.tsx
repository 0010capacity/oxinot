import { useMantineColorScheme } from "@mantine/core";
import { useEffect } from "react";
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
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const loadPage = useBlockStore((state) => state.loadPage);
  const createBlock = useBlockStore((state) => state.createBlock);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  const currentPageId = useBlockStore((state) => state.currentPageId);

  const focusedBlockId = useViewStore((state) => state.focusedBlockId);

  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    }
  }, [pageId, loadPage]);

  // Auto-create first block if page is empty
  useEffect(() => {
    if (!isLoading && !error && pageId && currentPageId === pageId) {
      const rootBlocks = childrenMap["root"] || [];
      const hasBlocks = rootBlocks.length > 0;

      if (!hasBlocks) {
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
    : childrenMap["root"] || [];

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
