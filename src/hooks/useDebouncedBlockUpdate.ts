import { useCallback, useEffect, useRef } from "react";
import { useBlockStore } from "../stores/blockStore";

const DEBOUNCE_MS = 300;

export function useDebouncedBlockUpdate(blockId: string) {
  // Store blockId in ref to avoid recreation of debounced function
  const blockIdRef = useRef(blockId);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | undefined>(undefined);

  // Update blockId ref when it changes
  useEffect(() => {
    blockIdRef.current = blockId;
  }, [blockId]);

  const debouncedUpdate = useCallback(
    (content: string) => {
      pendingContentRef.current = content;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (pendingContentRef.current !== undefined) {
          // Get current state to handle tempId -> realId mapping
          const state = useBlockStore.getState();
          let currentBlockId = blockIdRef.current;

          // Check if the block has been mapped from tempId to realId
          if (currentBlockId.startsWith("temp-")) {
            const realId = state.tempIdMap[currentBlockId];
            if (realId) {
              currentBlockId = realId;
            }
          }

          // Access the current version of updateBlockContent
          const currentUpdateBlockContent =
            useBlockStore.getState().updateBlockContent;
          currentUpdateBlockContent(currentBlockId, pendingContentRef.current);
          pendingContentRef.current = undefined;
        }
      }, DEBOUNCE_MS);
    },
    // Empty dependency array - blockId changes handled via ref
    []
  );

  const flushUpdate = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (pendingContentRef.current !== undefined) {
      // Get current state to handle tempId -> realId mapping
      const state = useBlockStore.getState();
      let currentBlockId = blockIdRef.current;

      // Check if the block has been mapped from tempId to realId
      if (currentBlockId.startsWith("temp-")) {
        const realId = state.tempIdMap[currentBlockId];
        if (realId) {
          currentBlockId = realId;
        }
      }

      const currentUpdateBlockContent =
        useBlockStore.getState().updateBlockContent;
      currentUpdateBlockContent(currentBlockId, pendingContentRef.current);
      pendingContentRef.current = undefined;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flushUpdate();
    };
  }, [flushUpdate]);

  return { debouncedUpdate, flushUpdate };
}
