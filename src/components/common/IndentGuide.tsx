import type { CSSProperties } from "react";

interface IndentGuideProps {
  depth: number;
  indentSize?: number;
  show?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reusable indent guide line component.
 * Displays a single vertical line for the current indentation level.
 *
 * Calculation:
 * - Each item has: paddingLeft = depth * 24px
 * - Inside padding: collapse-toggle (20px) + gap (8px) + bullet-container (24px, center at 12px)
 * - Bullet center for depth 0: 0 + 20 + 8 + 12 = 40px
 * - Bullet center for depth 1: 24 + 20 + 8 + 12 = 64px
 * - Bullet center for depth N: N * 24 + 40px
 *
 * Each component draws ONLY its own depth level guide to prevent overlapping.
 */
export function IndentGuide({
  depth,
  indentSize = 24,
  show = true,
  className = "",
  style,
}: IndentGuideProps) {
  if (!show || depth === 0) {
    return null;
  }

  // Calculate position for THIS depth level only
  const leftPosition = (depth - 1) * indentSize + 40;

  return (
    <div
      className={`indent-guide ${className}`}
      style={{
        position: "absolute",
        left: `${leftPosition}px`,
        top: 0,
        bottom: 0,
        width: "1px",
        backgroundColor: "var(--color-indent-guide)",
        pointerEvents: "none",
        zIndex: 0,
        ...style,
      }}
    />
  );
}
