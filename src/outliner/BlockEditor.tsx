import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { useEffect, useMemo } from "react";
import { LinkedReferences } from "../components/LinkedReferences";
import { SubPagesSection } from "../components/SubPagesSection";
import { ContentWrapper } from "../components/layout/ContentWrapper";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";
import { useBlockEditorCommands } from "../hooks/useBlockEditorCommands";
import { useBlockStore } from "../stores/blockStore";
import { useRegisterCommands } from "../stores/commandStore";
import { useThemeStore } from "../stores/themeStore";
import { showToast } from "../utils/toast";
import { BlockComponent } from "./BlockComponent";
import { VirtualBlockList } from "./VirtualBlockList";
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
  const currentPageId = useBlockStore((state) => state.currentPageId);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  const blocksById = useBlockStore((state) => state.blocksById);

  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);

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
      const renderStartTime = performance.now();
      console.log(
        `[BlockEditor:timing] Component rendering started for page ${pageId}`,
      );

      openPage(pageId);

      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStartTime;
        console.log(
          `[BlockEditor:timing] Component render completed in ${renderTime.toFixed(
            2,
          )}ms`,
        );
      });
    }
  }, [pageId, currentPageId, openPage]);

  const blocksToShow = childrenMap.root || [];

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
            pageName={pageName}
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
          ) : blocksToShow.length > 100 ? (
            (() => {
              const virtualListStart = performance.now();
              console.log(
                `[BlockEditor:timing] Rendering ${blocksToShow.length} blocks with VirtualBlockList`,
              );
              const result = (
                <VirtualBlockList
                  blockIds={blocksToShow}
                  blockOrder={blockOrder}
                  editorFontSize={editorFontSize}
                  editorLineHeight={editorLineHeight}
                />
              );
              requestAnimationFrame(() => {
                const virtualListTime = performance.now() - virtualListStart;
                console.log(
                  `[BlockEditor:timing] VirtualBlockList rendered in ${virtualListTime.toFixed(
                    2,
                  )}ms`,
                );
              });
              return result;
            })()
          ) : (
            (() => {
              const mapStart = performance.now();
              console.log(
                `[BlockEditor:timing] Rendering ${blocksToShow.length} blocks with .map()`,
              );
              const blocks = blocksToShow.map((blockId) => (
                <BlockComponent
                  key={blockId}
                  blockId={blockId}
                  depth={0}
                  blockOrder={blockOrder}
                />
              ));
              requestAnimationFrame(() => {
                const mapTime = performance.now() - mapStart;
                console.log(
                  `[BlockEditor:timing] BlockComponent .map() rendered in ${mapTime.toFixed(
                    2,
                  )}ms`,
                );
              });
              return blocks;
            })()
          )}
        </div>

        <SubPagesSection currentPageId={pageId} />

        <LinkedReferences pageId={pageId} />
      </ContentWrapper>
    </PageContainer>
  );
}
