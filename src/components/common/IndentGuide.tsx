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
            left: `${index * indentSize + 18}px`,
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
