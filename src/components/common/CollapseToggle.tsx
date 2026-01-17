import { IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import styles from "./CollapseToggle.module.css";

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
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${
        isCollapsed ? styles.collapsed : styles.expanded
      } ${className}`}
      onClick={onClick}
      style={style}
      aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
    >
      <IconChevronRight size={14} />
    </button>
  );
}
