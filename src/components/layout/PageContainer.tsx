import type { ReactNode, CSSProperties } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * PageContainer provides consistent outer container styling for all page layouts.
 * Uses CSS variables from the theme system for colors and spacing.
 */
export function PageContainer({
  children,
  className = "",
  style,
}: PageContainerProps) {
  return (
    <div
      className={`page-container ${className}`}
      style={{
        width: "100%",
        height: "100%",
        padding: "var(--layout-container-padding)",
        backgroundColor: "var(--color-bg-primary)",
        overflowY: "auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
