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
          // Access the current version of updateBlockContent
          const currentUpdateBlockContent =
            useBlockStore.getState().updateBlockContent;
          currentUpdateBlockContent(
            blockIdRef.current,
            pendingContentRef.current
          );
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
      const currentUpdateBlockContent =
        useBlockStore.getState().updateBlockContent;
      currentUpdateBlockContent(blockIdRef.current, pendingContentRef.current);
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
