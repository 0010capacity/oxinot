import { useMemo, useState } from "react";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { BulletPoint } from "./common/BulletPoint";
import { CollapseToggle } from "./common/CollapseToggle";
import "./SubPagesSection.css";
import { INDENT_PER_LEVEL } from "../constants/layout";

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
            className="page-tree-item"
            style={{
              paddingLeft: `${depth * INDENT_PER_LEVEL}px`,
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
              <div className="page-tree-item-toggle" />
            )}

            {/* Bullet point */}
            <BulletPoint type="default" />

            {/* Title */}
            <button
              type="button"
              onClick={() => handlePageClick(node.id)}
              className={`page-tree-item-title ${
                node.isDirectory ? "directory" : ""
              }`}
            >
              {node.title}
            </button>
          </div>

          {/* Render children recursively */}
          {hasChildren && !isCollapsed && (
            <div className="page-tree-children">
              {renderPageTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (childPages.length === 0) {
    return null;
  }

  return (
    <div className="subpages-container">
      <div className="subpages-header">Subpages</div>

      <div className="subpages-list">{renderPageTree(childPages)}</div>
    </div>
  );
}
