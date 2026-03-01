import { invoke } from "@tauri-apps/api/core";
import { ActionIcon, Box, Stack, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useBlockStore } from "../stores/blockStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { BlockData } from "../stores/blockStore";
import { buildPageBreadcrumb } from "../utils/pageUtils";
interface CalendarDropdownProps {
  onClose: () => void;
}

export function CalendarDropdown({ onClose }: CalendarDropdownProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const openPageByPath = usePageStore((state) => state.openPageByPath);
  const openNote = useViewStore((state) => state.openNote);
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );
  const dailyNoteTemplateId = useAppSettingsStore(
    (state) => state.dailyNoteTemplateId,
  );
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const openBlockPage = useBlockStore((state) => state.openPage);

  // Pre-calculate page paths for O(1) lookup
  // Map<FullPath, PageId>
  const pagePathMap = useMemo(() => {
    const map = new Map<string, string>();
    const buildPath = (pageId: string): string => {
      const page = pagesById[pageId];
      if (!page) return "";

      // If we already computed this page's path, verify if we can cache intermediate results.
      // For now, simple recursion is fine as we are building the whole map once per update.
      if (page.parentId) {
        const parentPath = buildPath(page.parentId);
        return parentPath ? `${parentPath}/${page.title}` : page.title;
      }
      return page.title;
    };

    for (const id of pageIds) {
      const path = buildPath(id);
      if (path) {
        map.set(path, id);
      }
    }
    return map;
  }, [pagesById, pageIds]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const getFullDailyNotePath = (date: Date) => {
    return getDailyNotePath(date);
  };

  const getDailyNotePage = (date: Date) => {
    const fullPath = getFullDailyNotePath(date);
    const pageId = pagePathMap.get(fullPath);
    return pageId ? pagesById[pageId] : undefined;
  };

  const copyTemplateBlocks = async (
    templatePageId: string,
    targetPageId: string,
  ) => {
    try {
      if (!workspacePath) {
        throw new Error("No workspace selected");
      }

      // Fetch template page blocks
      const templateBlocks: BlockData[] = await invoke("get_page_blocks", {
        workspacePath,
        pageId: templatePageId,
      });

      if (templateBlocks.length === 0) {
        return;
      }

      // Map to track original block ID to new block ID
      const blockIdMap = new Map<string, string>();

      // Create a map of original blocks for quick lookup
      const blockMap = new Map<string, BlockData>();
      for (const block of templateBlocks) {
        blockMap.set(block.id, block);
      }

      // Process blocks in order, ensuring parents are created before children
      const processedIds = new Set<string>();

      const processBlock = async (block: BlockData): Promise<string> => {
        // If already processed, return the mapped ID
        if (processedIds.has(block.id)) {
          const mappedId = blockIdMap.get(block.id);
          if (mappedId) {
            return mappedId;
          }
        }

        // Process parent first if it exists
        let newParentId: string | null = null;
        if (block.parentId) {
          const parentBlock = blockMap.get(block.parentId);
          if (parentBlock) {
            newParentId = await processBlock(parentBlock);
          }
        }

        // Create the block with correct parent
        const newBlock: BlockData = await invoke("create_block", {
          workspacePath,
          request: {
            pageId: targetPageId,
            parentId: newParentId,
            afterBlockId: null,
            content: block.content,
          },
        });

        blockIdMap.set(block.id, newBlock.id);
        processedIds.add(block.id);

        // Process children of this block
        const children = templateBlocks.filter((b) => b.parentId === block.id);
        for (const child of children) {
          await processBlock(child);
        }

        return newBlock.id;
      };

      // Process all root blocks
      const rootBlocks = templateBlocks.filter((b) => b.parentId === null);
      for (const rootBlock of rootBlocks) {
        await processBlock(rootBlock);
      }

      // Reload the target page to update blockStore
      await openBlockPage(targetPageId);
    } catch (error) {
      console.error("Failed to copy template blocks:", error);
    }
  };

  const handleDayClick = async (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const fullPath = getFullDailyNotePath(selectedDate);

    try {
      // Use openPageByPath which internally calls createPageHierarchy
      // This ensures intermediate paths are converted to directories
      const pageId = await openPageByPath(fullPath);

      // Get fresh page data from store after opening
      const freshPagesById = usePageStore.getState().pagesById;
      const page = freshPagesById[pageId];

      if (!page) {
        throw new Error("Page not found after opening");
      }

      // Copy template blocks only if the page is truly empty
      // Check block count to prevent overwriting existing content
      if (dailyNoteTemplateId && workspacePath) {
        try {
          const blocks: BlockData[] = await invoke("get_page_blocks", {
            workspacePath,
            pageId,
          });

          // Only copy template if page has just the initial empty block
          const isEmptyPage =
            blocks.length === 1 &&
            (blocks[0].content === "" ||
              blocks[0].content === page.title ||
              blocks[0].content === `- ${page.title}`);

          if (isEmptyPage) {
            await copyTemplateBlocks(dailyNoteTemplateId, pageId);
          }
        } catch (blockError) {
          console.warn(
            "[CalendarDropdown] Failed to check blocks, skipping template:",
            blockError,
          );
        }
      }

      // Build breadcrumb using utility function
      const { names, ids } = buildPageBreadcrumb(pageId, freshPagesById);

      setCurrentPageId(pageId);
      openNote(pageId, page.title, names, ids);
    } catch (error) {
      console.error("[CalendarDropdown] Failed to open daily note:", error);
    }

    onClose();
  };



  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Box
          key={`empty-${i}`}
          style={{
            aspectRatio: "1",
            padding: "6px",
          }}
        />,
      );
    }

    // Calendar days
    const today = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      const isToday = isCurrentMonth && day === today.getDate();
      const hasNote = !!getDailyNotePage(date);

      days.push(
        <Box
          key={day}
          onClick={() => handleDayClick(day)}
          style={{
            aspectRatio: "1",
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            borderRadius: "4px",
            border: isToday
              ? "2px solid var(--color-accent)"
              : "2px solid transparent",
            backgroundColor: hasNote
              ? "var(--color-interactive-selected)"
              : "transparent",
            transition: "all 0.15s ease",
            fontWeight: hasNote ? 600 : 400,
            color: "var(--color-text-secondary)",
            fontSize: "13px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--color-interactive-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasNote
              ? "var(--color-interactive-selected)"
              : "transparent";
          }}
        >
          <Text size="xs" style={{ fontSize: "13px" }}>
            {day}
          </Text>
        </Box>,
      );
    }

    return days;
  };

  return (
    <Stack gap="md" style={{ width: "280px" }}>
      {/* Month Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <ActionIcon variant="subtle" size="sm" onClick={handlePrevMonth}>
          <IconChevronLeft size={16} />
        </ActionIcon>
        <Text size="sm" fw={600} ta="center" style={{ flex: 1 }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <ActionIcon variant="subtle" size="sm" onClick={handleNextMonth}>
          <IconChevronRight size={16} />
        </ActionIcon>
      </div>

      {/* Day Labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "-4px",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Text
            key={day}
            size="xs"
            fw={600}
            ta="center"
            c="dimmed"
            style={{ padding: "4px 0", fontSize: "11px" }}
          >
            {day}
          </Text>
        ))}
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
        }}
      >
        {renderCalendar()}
      </div>
    </Stack>
  );
}
