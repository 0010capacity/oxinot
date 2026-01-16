import { Menu } from "@mantine/core";
import type React from "react";
import { useState } from "react";

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
  className?: string;
  style?: React.CSSProperties;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  sections,
  disabled = false,
  className,
  style,
}) => {
  const [opened, setOpened] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={className}
        style={{ position: "relative", ...style }}
        onContextMenuCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCoords({ x: e.clientX, y: e.clientY });
          setOpened(true);
        }}
      >
        {children}
      </div>

      <Menu
        opened={opened}
        onChange={setOpened}
        shadow="md"
        width={200}
        // Use a portal to ensure it renders at body level, avoiding z-index issues
        withinPortal={true}
        // We use a custom anchor, so position logic is handled by us (indirectly via the virtual target)
        position="bottom-start"
        // Close on any click outside
        closeOnClickOutside={true}
        // Trap focus to ensure keyboard navigation works within the menu
        trapFocus={true}
      >
        <Menu.Target>
          {/* Virtual Target: Positioned exactly at mouse coordinates */}
          <div
            style={{
              position: "fixed",
              top: coords.y,
              left: coords.x,
              width: 0,
              height: 0,
              visibility: "hidden",
              pointerEvents: "none", // Ensure it doesn't block clicks
            }}
          />
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
                    setOpened(false);
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
    </>
  );
};
