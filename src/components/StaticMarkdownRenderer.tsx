import { memo, useMemo } from "react";
import { renderOutlinerBulletPreviewHtml } from "../outliner/markdownRenderer";

interface StaticMarkdownRendererProps {
  content: string;
  onClick?: () => void;
  onMouseDownCapture?: (e: React.MouseEvent) => void;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Static HTML renderer for unfocused blocks.
 *
 * Purpose: Render block content as static HTML (no CodeMirror instance)
 * to avoid initializing 36+ CodeMirror instances on page load.
 *
 * Only focused blocks get Editor (CodeMirror). Unfocused blocks use this
 * component to display rendered markdown HTML with `dangerouslySetInnerHTML`.
 *
 * The renderer uses the existing `renderOutlinerBulletPreviewHtml()` function
 * from markdownRenderer.ts (markdown-it singleton instance).
 */
export const StaticMarkdownRenderer = memo(
  ({
    content,
    onClick,
    onMouseDownCapture,
    onPointerDownCapture,
    className = "static-markdown-renderer",
    style,
  }: StaticMarkdownRendererProps) => {
    // Memoize HTML rendering - only recompute when content changes
    const html = useMemo(() => {
      if (!content || content.trim().length === 0) {
        return "";
      }
      return renderOutlinerBulletPreviewHtml(content);
    }, [content]);

    // Default styles (can be overridden with style prop)
    const defaultStyle: React.CSSProperties = {
      minHeight: "24px", // Ensure consistent height even for empty blocks
      fontSize: "inherit",
      lineHeight: "inherit",
      cursor: "text",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      padding: "2px 0", // Match CodeMirror's padding
    };

    return (
      <div
        className={className}
        onClick={onClick}
        onMouseDownCapture={onMouseDownCapture}
        onPointerDownCapture={onPointerDownCapture}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ ...defaultStyle, ...style }}
      />
    );
  },
);

StaticMarkdownRenderer.displayName = "StaticMarkdownRenderer";
