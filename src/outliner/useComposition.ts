import { useRef, useCallback } from "react";

/**
 * Custom hook for handling IME (Input Method Editor) composition state.
 * Used for proper Korean, Japanese, and Chinese input handling.
 *
 * @returns Object with composition state and event handlers
 *
 * @example
 * const { isComposing, onCompositionStart, onCompositionEnd } = useComposition();
 *
 * <textarea
 *   onCompositionStart={onCompositionStart}
 *   onCompositionEnd={onCompositionEnd}
 *   onKeyDown={(e) => {
 *     if (isComposing()) return; // Skip special key handling during composition
 *     // ... handle special keys
 *   }}
 * />
 */
export function useComposition() {
  const isComposingRef = useRef(false);

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  const isComposing = useCallback(() => {
    return isComposingRef.current;
  }, []);

  return {
    isComposing,
    onCompositionStart,
    onCompositionEnd,
  };
}
