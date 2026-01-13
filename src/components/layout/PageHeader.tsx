import type { CSSProperties, ReactNode } from "react";
import { Breadcrumb } from "../Breadcrumb";

interface PageHeaderProps {
  title?: string;
  showBreadcrumb?: boolean;
  workspaceName?: string;
  pageName?: string;
  onNavigateHome?: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * PageHeader provides consistent header styling with optional title and breadcrumb.
 * Ensures FileTreeIndex and BlockEditor have unified header appearance.
 */
export function PageHeader({
  title,
  showBreadcrumb = false,
  workspaceName,
  pageName,
  onNavigateHome,
  children,
  className = "",
  style,
}: PageHeaderProps) {
  const hasContent = title || showBreadcrumb || children;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={`page-header ${className}`}
      style={{
        maxWidth: "var(--layout-max-content-width)",
        margin: "0 auto 32px",
        paddingLeft: "8px",
        paddingBottom: "16px",
        borderBottom: "1px solid var(--color-border-primary)",
        ...style,
      }}
    >
      {showBreadcrumb && workspaceName && onNavigateHome ? (
        <Breadcrumb
          workspaceName={workspaceName}
          pageName={pageName}
          onNavigateHome={onNavigateHome}
        />
      ) : null}

      {title ? (
        <div
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </div>
      ) : null}

      {children}
    </div>
  );
}
