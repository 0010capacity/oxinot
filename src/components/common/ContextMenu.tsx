import { Menu } from "@mantine/core";
import type React from "react";
import { useState, useCallback } from "react";

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
  textSelectionSections?: ContextMenuSection[]; // Optional sections for text selection
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  sections,
  textSelectionSections,
  disabled = false,
  className,
  style,
}) => {
  const [opened, setOpened] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [activeSections, setActiveSections] =
    useState<ContextMenuSection[]>(sections);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Check if there's selected text (not just cursor position)
      const selection = window.getSelection();
      let hasSelection = false;

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // collapsed means it's just a cursor, not a selection
        if (!range.collapsed) {
          const selectedText = selection.toString().trim();
          hasSelection = selectedText.length > 0;
        }
      }

      // If text is actually selected and we have textSelectionSections, use those
      if (
        hasSelection &&
        textSelectionSections &&
        textSelectionSections.length > 0
      ) {
        setActiveSections(textSelectionSections);
      } else {
        // Otherwise, use the default sections
        setActiveSections(sections);
      }

      setCoords({ x: e.clientX, y: e.clientY });
      setOpened(true);
    },
    [sections, textSelectionSections]
  );

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={className}
        style={{ position: "relative", ...style }}
        onContextMenuCapture={handleContextMenu}
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
          {activeSections.map((section, sectionIndex) => (
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
              {sectionIndex < activeSections.length - 1 && <Menu.Divider />}
            </div>
          ))}
        </Menu.Dropdown>
      </Menu>
    </>
  );
};
