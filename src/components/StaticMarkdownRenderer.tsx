import { memo, useMemo } from "react";
import { renderOutlinerBulletPreviewHtml } from "../outliner/markdownRenderer";
import { useBlockUIStore } from "../stores/blockUIStore";

interface StaticMarkdownRendererProps {
  content: string;
  onClick?: () => void;
  onMouseDownCapture?: (e: React.MouseEvent) => void;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const StaticMarkdownRenderer = memo(
  ({
    content,
    onClick,
    onMouseDownCapture,
    onPointerDownCapture,
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

    // Default styles (can be overridden with style prop)
    const defaultStyle: React.CSSProperties = {
      minHeight: "24px",
      fontSize: "inherit",
      lineHeight: "inherit",
      cursor: "text",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      padding: "2px 0",
    };

    return (
      <div
        className={`${className} block-static-content`}
        onClick={onClick}
        onMouseDownCapture={handleMouseDownCapture}
        onPointerDownCapture={handlePointerDownCapture}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ ...defaultStyle, ...style }}
      />
    );
  },
);

StaticMarkdownRenderer.displayName = "StaticMarkdownRenderer";
