import type React from "react";
import { Menu } from "@mantine/core";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  children: React.ReactNode;
  sections: ContextMenuSection[];
  disabled?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  sections,
  disabled = false,
}) => {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Menu shadow="md" width={200} position="right-start" withArrow>
      <Menu.Target>
        <div
          onContextMenu={(e) => {
            e.preventDefault();
          }}
        >
          {children}
        </div>
      </Menu.Target>

      <Menu.Dropdown>
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.items.map((item, itemIndex) => (
              <Menu.Item
                key={itemIndex}
                leftSection={item.icon}
                color={item.color}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                }}
                disabled={item.disabled}
              >
                {item.label}
              </Menu.Item>
            ))}
            {sectionIndex < sections.length - 1 && <Menu.Divider />}
          </div>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};
