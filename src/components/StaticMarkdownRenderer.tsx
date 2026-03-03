import { memo, useEffect, useMemo, useRef } from "react";
import { renderOutlinerBulletPreviewHtml } from "../outliner/markdownRenderer";
import { useBlockUIStore } from "../stores/blockUIStore";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { findPageByPath } from "../utils/pageUtils";

interface StaticMarkdownRendererProps {
  content: string;
  onClick?: () => void;
  onMouseDownCapture?: (e: React.MouseEvent) => void;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const StaticMarkdownRenderer = memo(
  ({
    content,
    onClick,
    onMouseDownCapture,
    onPointerDownCapture,
    onKeyDown,
    className = "static-markdown-renderer",
    style,
  }: StaticMarkdownRendererProps) => {
    const isComposing = useBlockUIStore((state) => state.isComposing);

    // Memoize HTML rendering - only recompute when content changes
    const html = useMemo(() => {
      if (!content || content.trim().length === 0) {
        return "";
      }
      return renderOutlinerBulletPreviewHtml(content);
    }, [content]);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageIds = usePageStore((s) => s.pageIds);
    const pagesById = usePageStore((s) => s.pagesById);
    const blocksById = useBlockStore((s) => s.blocksById);

    // After rendering, mark wiki links as existing/missing and block refs as broken
    // biome-ignore lint/correctness/useExhaustiveDependencies: html triggers re-check when DOM content changes via dangerouslySetInnerHTML
    useEffect(() => {
      const el = containerRef.current;
      if (!el || pageIds.length === 0) return;

      const links = el.querySelectorAll("a.wiki-link[data-page]");
      for (const link of links) {
        const pageName = link.getAttribute("data-page") ?? "";
        if (!pageName) continue;

        // Check by full path first, then by title
        const foundByPath = findPageByPath(pageName, pageIds, pagesById);
        let exists = foundByPath !== undefined;
        if (!exists) {
          const normalized = pageName.toLowerCase().trim();
          for (const id of pageIds) {
            const p = pagesById[id];
            if (p && p.title.toLowerCase() === normalized) {
              exists = true;
              break;
            }
          }
        }

        link.classList.toggle("wiki-link-missing", !exists);
      }

      // Check block refs for broken references
      const blockRefs = el.querySelectorAll("a.block-ref[data-block-id]");
      for (const ref of blockRefs) {
        const blockId = ref.getAttribute("data-block-id") ?? "";
        if (!blockId) continue;
        const blockExists = blocksById[blockId] !== undefined;
        ref.classList.toggle("block-ref-broken", !blockExists);
      }
    }, [html, pageIds, pagesById, blocksById]);
    const handleMouseDownCapture = (e: React.MouseEvent) => {
      if (isComposing) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      onMouseDownCapture?.(e);
    };

    const handlePointerDownCapture = (e: React.PointerEvent) => {
      if (isComposing) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      onPointerDownCapture?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (isComposing) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Allow Enter or Space to trigger the click action
      if ((e.key === "Enter" || e.key === " ") && onClick) {
        e.preventDefault();
        onClick();
        return;
      }

      onKeyDown?.(e);
    };

    // Default styles are now handled by CSS variables in block-styles.css
    // The style prop can still be used for custom overrides
    return (
      <div
        ref={containerRef}
        className={`${className} block-static-content`}
        onClick={onClick}
        onMouseDownCapture={handleMouseDownCapture}
        onPointerDownCapture={handlePointerDownCapture}
        onKeyDown={handleKeyDown}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is trusted: markdown rendered from internal outliner
        dangerouslySetInnerHTML={{ __html: html }}
        style={style}
        role="button"
        tabIndex={onClick ? 0 : undefined}
      />
    );
  },
);

StaticMarkdownRenderer.displayName = "StaticMarkdownRenderer";
