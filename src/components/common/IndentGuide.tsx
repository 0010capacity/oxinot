import type { CSSProperties } from "react";
import { INDENT_PER_LEVEL } from "../../constants/layout";
import styles from "./IndentGuide.module.css";

interface IndentGuideProps {
  depth: number;
  indentSize?: number;
  show?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reusable indent guide line component.
 * Displays a single vertical line at the parent level's bullet center.
 *
 * Position is computed structurally from CSS layout variables:
 *   left = (depth - 1) * indent-size + collapse-toggle-size + flex-gap + bullet-container-size / 2
 *
 * Used by the file tree (PageTreeItem). The block editor (BlockComponent)
 * computes its own offset via --layout-indent-guide-offset which includes
 * an additional collapse-toggle margin-left.
 */
export function IndentGuide({
  depth,
  indentSize = INDENT_PER_LEVEL,
  show = true,
  className = "",
  style,
}: IndentGuideProps) {
  if (!show || depth === 0) {
    return null;
  }

  // Depth-dependent portion computed in JS; structural offset deferred to CSS calc()
  const depthOffset = (depth - 1) * indentSize;

  return (
    <div
      className={`${styles.indentGuide} ${className}`}
      style={{
        left: `calc(${depthOffset}px + var(--layout-collapse-toggle-size) + var(--spacing-sm) + var(--layout-bullet-container-size) / 2)`,
        ...style,
      }}
    />
  );
}
