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
 * Displays vertical lines to show indentation levels in hierarchical structures.
 *
 * Calculation:
 * - Each item has: paddingLeft = depth * 24px
 * - Inside padding: collapse-toggle (20px) + gap (8px) + bullet-container (24px, center at 12px)
 * - Bullet center for depth 0: 0 + 20 + 8 + 12 = 40px
 * - Bullet center for depth 1: 24 + 20 + 8 + 12 = 64px
 * - Bullet center for depth N: N * 24 + 40px
 *
 * For depth N, we need to draw guides for levels 0 to N-1:
 * - Level 0 guide at: 40px
 * - Level 1 guide at: 64px
 * - Level K guide at: K * 24 + 40px
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

  return (
    <>
      {Array.from({ length: depth }).map((_, index) => (
        <div
          key={index}
          className={`indent-guide ${className}`}
          style={{
            position: "absolute",
            left: `${index * indentSize + 40}px`,
            top: 0,
            bottom: 0,
            width: "1px",
            backgroundColor: "var(--color-indent-guide)",
            pointerEvents: "none",
            zIndex: 0,
            ...style,
          }}
        />
      ))}
    </>
  );
}
