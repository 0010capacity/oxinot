import { useEffect } from "react";
import { useUpdaterStore } from "../stores/updaterStore";

export function Updater() {
  const checkForUpdates = useUpdaterStore((state) => state.checkForUpdates);

  // Check for updates on mount (silent check)
  useEffect(() => {
    checkForUpdates(true);
  }, [checkForUpdates]);

  // No UI, just background logic
  return null;
}

export { Updater as default };
