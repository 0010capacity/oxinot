import { useComputedColorScheme } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { IconCopy } from "@tabler/icons-react";
import { LinkedReferences } from "../components/LinkedReferences";
import { SubPagesSection } from "../components/SubPagesSection";
import { BlockSelectionToolbar } from "../components/BlockSelectionToolbar";
import { ContentWrapper } from "../components/layout/ContentWrapper";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore, useSelectionCount } from "../stores/blockUIStore";
import { useThemeStore } from "../stores/themeStore";
import { useViewStore } from "../stores/viewStore";
import { useRegisterCommands } from "../stores/commandStore";
import { showToast } from "../utils/toast";
import {
  indentBlocks,
  outdentBlocks,
  deleteBlocks,
} from "../utils/batchBlockOperations";
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

  const openPage = useBlockStore((state) => state.openPage);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const focusedBlockId = useViewStore((state) => state.focusedBlockId);
  const selectionCount = useSelectionCount();
  const selectedBlockIds = useBlockUIStore((state) => state.selectedBlockIds);

  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);

  // Register context-aware commands
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
      [pageId, pageName]
    )
  );

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      openPage(pageId);
    }
  }, [pageId, openPage]);

  // Batch operation handlers
  const handleBatchIndent = async () => {
    try {
      await indentBlocks(selectedBlockIds);
      showToast({
        message: `Indented ${selectedBlockIds.length} blocks`,
        type: "success",
      });
    } catch (err) {
      showToast({
        message: "Failed to indent blocks",
        type: "error",
      });
    }
  };

  const handleBatchOutdent = async () => {
    try {
      await outdentBlocks(selectedBlockIds);
      showToast({
        message: `Outdented ${selectedBlockIds.length} blocks`,
        type: "success",
      });
    } catch (err) {
      showToast({
        message: "Failed to outdent blocks",
        type: "error",
      });
    }
  };

  const handleBatchDelete = async () => {
    try {
      await deleteBlocks(selectedBlockIds);
      showToast({
        message: `Deleted ${selectedBlockIds.length} blocks`,
        type: "success",
      });
    } catch (err) {
      showToast({
        message: "Failed to delete blocks",
        type: "error",
      });
    }
  };

  // Determine which blocks to show based on zoom level
  const blocksToShow = focusedBlockId
    ? [focusedBlockId]
    : childrenMap.root || [];

  // Get ordered block IDs for range selection
  const blockOrder = useMemo(() => blocksToShow, [blocksToShow]);

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

        {/* Selection Toolbar */}
        <BlockSelectionToolbar
          selectedCount={selectionCount}
          onDelete={handleBatchDelete}
          onIndent={handleBatchIndent}
          onOutdent={handleBatchOutdent}
        />

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
              <BlockComponent
                key={blockId}
                blockId={blockId}
                depth={0}
                blockOrder={blockOrder}
              />
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
