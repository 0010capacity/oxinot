import { useEffect } from "react";
import { useUpdaterStore } from "../stores/updaterStore";

export function Updater() {
  const checkForUpdates = useUpdaterStore((state) => state.checkForUpdates);

  // Check for updates on mount (silent check)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally checking on mount only
  useEffect(() => {
    checkForUpdates(true);
  }, []);

  // No UI, just background logic
  return null;
}

export { Updater as default };