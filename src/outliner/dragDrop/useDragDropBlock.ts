import { useCallback } from "react";
import { useBlockStore } from "../../stores/blockStore";

interface DragDropContext {
  draggedBlockId: string | null;
  dragOverBlockId: string | null;
  dragPosition: "above" | "below" | "inside" | null;
}

const dragContextRef = { current: null as DragDropContext | null };

export function useDragDropBlock() {
  const moveBlock = useBlockStore((state) => state.moveBlock);
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const handleDragStart = useCallback((blockId: string) => {
    dragContextRef.current = {
      draggedBlockId: blockId,
      dragOverBlockId: null,
      dragPosition: null,
    };
  }, []);

  const handleDragOver = useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      targetBlockId: string,
      position: "above" | "below" | "inside",
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (!dragContextRef.current) {
        dragContextRef.current = {
          draggedBlockId: null,
          dragOverBlockId: targetBlockId,
          dragPosition: position,
        };
      } else {
        dragContextRef.current.dragOverBlockId = targetBlockId;
        dragContextRef.current.dragPosition = position;
      }

      event.dataTransfer.dropEffect = "move";
    },
    [],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, targetBlockId: string) => {
      event.preventDefault();
      event.stopPropagation();

      const context = dragContextRef.current;
      if (!context || !context.draggedBlockId) {
        dragContextRef.current = null;
        return;
      }

      const draggedId = context.draggedBlockId;

      if (draggedId === targetBlockId) {
        dragContextRef.current = null;
        return;
      }

      const draggedBlock = blocksById[draggedId];
      const targetBlock = blocksById[targetBlockId];

      if (!draggedBlock || !targetBlock) {
        dragContextRef.current = null;
        return;
      }

      try {
        let newParentId: string | null = null;
        let afterBlockId: string | null = null;

        if (context.dragPosition === "inside") {
          newParentId = targetBlockId;
          afterBlockId = null;
        } else if (context.dragPosition === "below") {
          newParentId = targetBlock.parentId || null;
          afterBlockId = targetBlockId;
        } else {
          newParentId = targetBlock.parentId || null;
          const siblings = newParentId
            ? childrenMap[newParentId] || []
            : childrenMap.root || [];
          const targetIndex = siblings.findIndex((id) => id === targetBlockId);
          afterBlockId = targetIndex > 0 ? siblings[targetIndex - 1] : null;
        }

        await moveBlock(draggedId, newParentId, afterBlockId);
      } catch (error) {
        console.error("Failed to move block:", error);
      } finally {
        dragContextRef.current = null;
      }
    },
    [blocksById, childrenMap, moveBlock],
  );

  const handleDragEnd = useCallback(() => {
    dragContextRef.current = null;
  }, []);

  const getDragOverClass = useCallback((blockId: string): string => {
    if (
      !dragContextRef.current ||
      dragContextRef.current.dragOverBlockId !== blockId
    ) {
      return "";
    }

    const position = dragContextRef.current.dragPosition;
    if (position === "above") return "drag-over-above";
    if (position === "below") return "drag-over-below";
    if (position === "inside") return "drag-over-inside";
    return "";
  }, []);

  return {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    getDragOverClass,
    isDragging: dragContextRef.current?.draggedBlockId !== null,
  };
}
