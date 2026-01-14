import { useCallback, useRef, useState } from "react";
import { useBlockStore } from "../../stores/blockStore";

interface DragDropContext {
  draggedBlockId: string | null;
  dragOverBlockId: string | null;
  dragPosition: "above" | "below" | "inside" | null;
}

export function useDragDropBlock() {
  const moveBlock = useBlockStore((state) => state.moveBlock);
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  // Use state instead of ref to trigger re-renders
  const [dragContext, setDragContext] = useState<DragDropContext>({
    draggedBlockId: null,
    dragOverBlockId: null,
    dragPosition: null,
  });

  const dragContextRef = useRef<DragDropContext>(dragContext);

  // Keep ref in sync with state
  dragContextRef.current = dragContext;

  const handleDragStart = useCallback((blockId: string) => {
    setDragContext({
      draggedBlockId: blockId,
      dragOverBlockId: null,
      dragPosition: null,
    });
  }, []);

  const handleDragOver = useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      targetBlockId: string,
      position: "above" | "below" | "inside",
    ) => {
      event.preventDefault();
      event.stopPropagation();

      setDragContext((prev) => ({
        ...prev,
        dragOverBlockId: targetBlockId,
        dragPosition: position,
      }));

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
        setDragContext({
          draggedBlockId: null,
          dragOverBlockId: null,
          dragPosition: null,
        });
        return;
      }

      const draggedId = context.draggedBlockId;

      if (draggedId === targetBlockId) {
        setDragContext({
          draggedBlockId: null,
          dragOverBlockId: null,
          dragPosition: null,
        });
        return;
      }

      const draggedBlock = blocksById[draggedId];
      const targetBlock = blocksById[targetBlockId];

      if (!draggedBlock || !targetBlock) {
        setDragContext({
          draggedBlockId: null,
          dragOverBlockId: null,
          dragPosition: null,
        });
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
        setDragContext({
          draggedBlockId: null,
          dragOverBlockId: null,
          dragPosition: null,
        });
      }
    },
    [blocksById, childrenMap, moveBlock],
  );

  const handleDragEnd = useCallback(() => {
    setDragContext({
      draggedBlockId: null,
      dragOverBlockId: null,
      dragPosition: null,
    });
  }, []);

  const getDragOverClass = useCallback(
    (blockId: string): string => {
      if (dragContext.dragOverBlockId !== blockId) {
        return "";
      }

      const position = dragContext.dragPosition;
      if (position === "above") return "drag-over-above";
      if (position === "below") return "drag-over-below";
      if (position === "inside") return "drag-over-inside";
      return "";
    },
    [dragContext],
  );

  return {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    getDragOverClass,
    isDragging: dragContext.draggedBlockId !== null,
  };
}
