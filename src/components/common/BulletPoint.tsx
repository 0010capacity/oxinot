import type { CSSProperties } from "react";

interface BulletPointProps {
  type?: "default" | "fence" | "code";
  isActive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reusable bullet point component used in both FileTreeIndex and BlockEditor.
 * Supports different types (default, fence, code) with consistent styling.
 */
export function BulletPoint({
  type = "default",
  isActive = false,
  onClick,
  className = "",
  style,
}: BulletPointProps) {
  const getBulletStyle = (): CSSProperties => {
    const baseStyle: CSSProperties = {
      width: "var(--layout-bullet-size)",
      height: "var(--layout-bullet-size)",
      borderRadius: "50%",
      backgroundColor: isActive
        ? "var(--color-bullet-active)"
        : "var(--color-bullet-default)",
      transition: "all var(--transition-slow)",
      display: "block",
      border: "1px solid transparent",
    };

    if (type === "fence") {
      return {
        ...baseStyle,
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        transform: isActive ? "rotate(45deg) scale(1.3)" : "rotate(45deg)",
        backgroundColor: isActive
          ? "var(--color-interactive-focus)"
          : "var(--color-interactive-selected)",
        borderColor: isActive
          ? "var(--color-accent)"
          : "var(--color-interactive-focus)",
      };
    }

    if (type === "code") {
      return {
        ...baseStyle,
        width: "8px",
        height: "8px",
        borderRadius: "1px",
        backgroundColor: "var(--color-success)",
        borderColor: "var(--color-success)",
        opacity: isActive ? "0.7" : "0.4",
        transform: isActive ? "scale(1.3)" : "none",
      };
    }

    // Default type
    return {
      ...baseStyle,
      transform: isActive ? "scale(1.3)" : "none",
    };
  };

  const containerStyle: CSSProperties = {
    flexShrink: 0,
    width: "var(--layout-bullet-container-size)",
    height: "var(--layout-bullet-container-size)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
    position: "relative",
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  return (
    <div
      className={`bullet-point-wrapper ${className}`}
      style={containerStyle}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={(e) => {
        const bullet = e.currentTarget.querySelector(
          ".bullet-point",
        ) as HTMLElement;
        if (bullet && !isActive) {
          bullet.style.backgroundColor = "var(--color-bullet-hover)";
          if (type === "default") {
            bullet.style.transform = "scale(1.2)";
          }
        }
      }}
      onMouseLeave={(e) => {
        const bullet = e.currentTarget.querySelector(
          ".bullet-point",
        ) as HTMLElement;
        if (bullet && !isActive) {
          bullet.style.backgroundColor =
            type === "default"
              ? "var(--color-bullet-default)"
              : type === "code"
                ? "var(--color-success)"
                : "var(--color-interactive-selected)";
          if (type === "default") {
            bullet.style.transform = "none";
          }
        }
      }}
    >
      <div className="bullet-point" style={getBulletStyle()} />
    </div>
  );
}
