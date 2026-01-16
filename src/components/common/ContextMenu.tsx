import { Menu } from "@mantine/core";
import type React from "react";
import { forwardRef, useState } from "react";

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

// Custom trigger to hijack the default click behavior
// We want to open on context-menu (right click), not left click.
// Mantine Menu passes 'onClick' to the target to toggle the menu.
// We intercept that to prevent left-click opening, while preserving the ref for positioning.
interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  onTriggerClick?: () => void;
}

const ContextMenuTrigger = forwardRef<HTMLDivElement, ContextMenuTriggerProps>(
  ({ onClick, onContextMenu, onTriggerClick, children, ...other }, ref) => {
    return (
      <div
        ref={ref}
        onContextMenu={onContextMenu}
        onClick={() => {
          // Close the menu if clicked (optional, ensures clean state)
          onTriggerClick?.();
          // We intentionally do NOT call the 'onClick' passed by Mantine (which would toggle the menu)
        }}
        {...other}
      >
        {children}
      </div>
    );
  },
);

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  sections,
  disabled = false,
}) => {
  const [opened, setOpened] = useState(false);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      shadow="md"
      width={200}
      position="bottom-start"
      withArrow
      trigger="click" // We control the trigger manually via state
      closeOnClickOutside={true}
    >
      <Menu.Target>
        <ContextMenuTrigger
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setOpened(true);
          }}
          onTriggerClick={() => setOpened(false)}
        >
          {children}
        </ContextMenuTrigger>
      </Menu.Target>

      <Menu.Dropdown>
        {sections.map((section, sectionIndex) => (
          <div key={section.items[0]?.label || sectionIndex}>
            {section.items.map((item) => (
              <Menu.Item
                key={item.label}
                leftSection={item.icon}
                color={item.color}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  setOpened(false); // Close after action
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