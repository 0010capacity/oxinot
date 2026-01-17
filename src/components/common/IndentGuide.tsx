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
 * Displays a single vertical line for the current indentation level.
 *
 * Calculation:
 * - Each item has: paddingLeft = depth * INDENT_PER_LEVEL
 * - Inside padding: collapse-toggle (20px) + gap (8px) + bullet-container (24px, center at 12px)
 * - Bullet center for depth 0: 0 + 20 + 8 + 12 = 40px
 * - Bullet center for depth 1: 24 + 20 + 8 + 12 = 64px
 * - Bullet center for depth N: N * 24 + 40px
 *
 * Each component draws ONLY its own depth level guide to prevent overlapping.
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

  // Calculate position for THIS depth level only
  const leftPosition = (depth - 1) * indentSize + 40;

  return (
    <div
      className={`${styles.indentGuide} ${className}`}
      style={{
        left: `${leftPosition}px`,
        ...style,
      }}
    />
  );
}
