import { useCallback, useEffect, useRef } from "react";
import { useBlockStore } from "../stores/blockStore";

const DEBOUNCE_MS = 300;

export function useDebouncedBlockUpdate(blockId: string) {
  const updateBlockContent = useBlockStore((state) => state.updateBlockContent);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | undefined>(undefined);

  const debouncedUpdate = useCallback(
    (content: string) => {
      pendingContentRef.current = content;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (pendingContentRef.current !== undefined) {
          updateBlockContent(blockId, pendingContentRef.current);
          pendingContentRef.current = undefined;
        }
      }, DEBOUNCE_MS);
    },
    [blockId, updateBlockContent]
  );

  const flushUpdate = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (pendingContentRef.current !== undefined) {
      updateBlockContent(blockId, pendingContentRef.current);
      pendingContentRef.current = undefined;
    }
  }, [blockId, updateBlockContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flushUpdate();
    };
  }, [flushUpdate]);

  return { debouncedUpdate, flushUpdate };
}
