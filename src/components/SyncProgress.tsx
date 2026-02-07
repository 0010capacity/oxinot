import { useSyncStore } from "../stores/syncStore";

export function SyncProgress() {
  const { isReindexing } = useSyncStore();

  if (!isReindexing) {
    return null;
  }

  return null;
}
