import { memo, useMemo } from "react";
import { renderOutlinerBulletPreviewHtml } from "../outliner/markdownRenderer";
import { useBlockUIStore } from "../stores/blockUIStore";

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
  }
);

StaticMarkdownRenderer.displayName = "StaticMarkdownRenderer";
