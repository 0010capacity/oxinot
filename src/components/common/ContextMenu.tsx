import { Menu } from "@mantine/core";
import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { create } from "zustand";

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

// Global state to ensure only one context menu is open at a time
interface ContextMenuState {
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

const useContextMenuStore = create<ContextMenuState>((set) => ({
  openMenuId: null,
  setOpenMenuId: (id) => set({ openMenuId: id }),
}));

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
  const menuId = useRef(`context-menu-${Math.random()}`).current;
  const openMenuId = useContextMenuStore((state) => state.openMenuId);
  const setOpenMenuId = useContextMenuStore((state) => state.setOpenMenuId);
  const opened = openMenuId === menuId;

  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [activeSections, setActiveSections] =
    useState<ContextMenuSection[]>(sections);
  const savedSelectionRef = useRef<{
    text: string;
    ranges: Range[];
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setOpenMenuId(menuId);
      } else if (openMenuId === menuId) {
        setOpenMenuId(null);
      }
    },
    [menuId, openMenuId, setOpenMenuId],
  );

  // Save selection on mousedown before browser can change it
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          // Only save if it's an actual selection (not just a cursor)
          if (!range.collapsed) {
            const ranges: Range[] = [];
            for (let i = 0; i < selection.rangeCount; i++) {
              ranges.push(selection.getRangeAt(i).cloneRange());
            }
            savedSelectionRef.current = {
              text: selection.toString(),
              ranges,
            };
            console.log(
              "[ContextMenu] Saved selection on mousedown:",
              savedSelectionRef.current.text,
            );
            return;
          }
        }
        // No valid selection, clear it
        savedSelectionRef.current = null;
        console.log("[ContextMenu] No selection on mousedown");
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", handleMouseDown, true);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Use the saved selection from mousedown, not the current one
      const savedSelection = savedSelectionRef.current;
      let hasSelection = false;

      console.log("[ContextMenu] Right-click detected");
      console.log("[ContextMenu] savedSelection:", savedSelection);

      if (savedSelection && savedSelection.text.trim().length > 0) {
        hasSelection = true;
        console.log(
          "[ContextMenu] hasSelection:",
          hasSelection,
          "text:",
          savedSelection.text,
        );
      }

      console.log("[ContextMenu] Final hasSelection:", hasSelection);
      console.log(
        "[ContextMenu] textSelectionSections available:",
        !!textSelectionSections,
      );

      // If text is actually selected and we have textSelectionSections, use those
      if (
        hasSelection &&
        textSelectionSections &&
        textSelectionSections.length > 0
      ) {
        console.log("[ContextMenu] Using text selection menu");
        setActiveSections(textSelectionSections);
      } else {
        // Otherwise, use the default sections
        console.log("[ContextMenu] Using default menu");
        setActiveSections(sections);
      }

      setCoords({ x: e.clientX, y: e.clientY });
      setOpenMenuId(menuId);
    },
    [sections, textSelectionSections, menuId, setOpenMenuId],
  );

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{ position: "relative", ...style }}
        onContextMenuCapture={handleContextMenu}
      >
        {children}
      </div>

      <Menu
        opened={opened}
        onChange={handleOpenChange}
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
                    setOpenMenuId(null);
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
