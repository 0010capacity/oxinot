import { useCallback } from "react";
import { useBlockUIStore } from "../stores/blockUIStore";

export function useComposition() {
  const setIsComposing = useBlockUIStore((state) => state.setIsComposing);
  const isComposing = useBlockUIStore((state) => state.isComposing);

  const onCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, [setIsComposing]);

  const onCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, [setIsComposing]);

  const getIsComposing = useCallback(() => {
    return isComposing;
  }, [isComposing]);

  return {
    isComposing: getIsComposing,
    onCompositionStart,
    onCompositionEnd,
  };
}
