import type { ReactNode, CSSProperties } from "react";

interface ContentWrapperProps {
  children: ReactNode;
  maxWidth?: string;
  paddingBottom?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * ContentWrapper constrains content width and provides consistent padding.
 * Used to ensure FileTreeIndex and BlockEditor have identical layout.
 */
export function ContentWrapper({
  children,
  maxWidth = "var(--layout-max-content-width)",
  paddingBottom = "var(--layout-content-bottom-padding)",
  className = "",
  style,
}: ContentWrapperProps) {
  return (
    <div
      className={`content-wrapper ${className}`}
      style={{
        maxWidth,
        margin: "0 auto",
        paddingBottom,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
