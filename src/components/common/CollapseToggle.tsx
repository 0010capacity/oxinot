import { IconChevronRight } from "@tabler/icons-react";
import type { CSSProperties } from "react";

interface CollapseToggleProps {
  isCollapsed: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reusable collapse/expand toggle button.
 * Used in FileTreeIndex for page hierarchies and BlockEditor for block hierarchies.
 */
export function CollapseToggle({
  isCollapsed,
  onClick,
  className = "",
  style,
}: CollapseToggleProps) {
  return (
    <button
      type="button"
      className={`collapse-toggle ${isCollapsed ? "collapsed" : "expanded"} ${className}`}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: "var(--layout-collapse-toggle-size)",
        height: "var(--layout-collapse-toggle-size)",
        padding: 0,
        margin: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "currentColor",
        fontSize: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: isCollapsed ? "var(--opacity-disabled)" : 0,
        transition:
          "opacity var(--transition-normal), background-color var(--transition-normal)",
        borderRadius: "var(--radius-sm)",
        position: "relative",
        zIndex: 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.backgroundColor =
          "var(--color-interactive-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = isCollapsed
          ? "var(--opacity-disabled)"
          : "0";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      aria-label={isCollapsed ? "Expand" : "Collapse"}
    >
      <IconChevronRight
        size={14}
        style={{
          transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
          transition: "transform var(--transition-normal)",
        }}
      />
    </button>
  );
}
