import { useMantineColorScheme } from "@mantine/core";
import { useMemo, useState } from "react";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { BulletPoint } from "./common/BulletPoint";
import { CollapseToggle } from "./common/CollapseToggle";

interface SubPagesSectionProps {
  currentPageId: string;
}

interface PageTreeNode {
  id: string;
  title: string;
  isDirectory: boolean;
  children: PageTreeNode[];
}

export function SubPagesSection({ currentPageId }: SubPagesSectionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const { openNote } = useViewStore();
  const selectPage = usePageStore((state) => state.selectPage);
  const loadPage = useBlockStore((state) => state.loadPage);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Build tree structure recursively
  const childPages = useMemo(() => {
    const buildTree = (parentId: string): PageTreeNode[] => {
      return pageIds
        .map((id) => pagesById[id])
        .filter((page) => page && page.parentId === parentId)
        .sort((a, b) => {
          // Sort directories first, then by title
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.title.localeCompare(b.title);
        })
        .map((page) => ({
          id: page.id,
          title: page.title,
          isDirectory: page.isDirectory,
          children: buildTree(page.id),
        }));
    };
    return buildTree(currentPageId);
  }, [pageIds, pagesById, currentPageId]);

  const handlePageClick = async (pageId: string) => {
    const page = pagesById[pageId];
    if (!page) return;

    // Build parent path
    const parentNames: string[] = [];
    const pagePathIds: string[] = [];

    const buildParentPath = (pid: string) => {
      const p = pagesById[pid];
      if (!p) return;

      if (p.parentId) {
        buildParentPath(p.parentId);
      }

      parentNames.push(p.title);
      pagePathIds.push(p.id);
    };

    if (page.parentId) {
      buildParentPath(page.parentId);
    }

    await selectPage(page.id);
    await loadPage(page.id);
    openNote(page.id, page.title, parentNames, pagePathIds);
  };

  const toggleCollapse = (pageId: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  };

  const renderPageTree = (nodes: PageTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed[node.id];

      return (
        <div key={node.id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingLeft: `${depth * 24}px`,
              paddingTop: "4px",
              paddingBottom: "4px",
              cursor: "pointer",
              borderRadius: "4px",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {/* Collapse toggle */}
            {hasChildren ? (
              <CollapseToggle
                isCollapsed={isCollapsed}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(node.id);
                }}
              />
            ) : (
              <div style={{ width: "16px", flexShrink: 0 }} />
            )}

            {/* Bullet point */}
            <BulletPoint type="default" />

            {/* Title */}
            <button
              type="button"
              onClick={() => handlePageClick(node.id)}
              style={{
                fontSize: "15px",
                color: isDark
                  ? "rgba(255, 255, 255, 0.85)"
                  : "rgba(0, 0, 0, 0.85)",
                fontWeight: node.isDirectory ? 500 : 400,
                userSelect: "none",
                cursor: "pointer",
                border: "none",
                background: "none",
                padding: "0",
              }}
            >
              {node.title}
            </button>
          </div>

          {/* Render children recursively */}
          {hasChildren && !isCollapsed && (
            <div>{renderPageTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (childPages.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "48px",
        paddingTop: "24px",
        borderTop: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
          marginBottom: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Subpages
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {renderPageTree(childPages)}
      </div>
    </div>
  );
}
