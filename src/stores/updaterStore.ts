import { relaunch } from "@tauri-apps/plugin-process";
import { type Update, check } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

interface UpdaterState {
  status:
    | "idle"
    | "checking"
    | "available"
    | "uptodate"
    | "error"
    | "downloading"
    | "downloaded";
  version: string | null;
  currentVersion: string | null;
  date: string | null;
  body: string | null;
  error: string | null;
  progress: number;
  updateObj: Update | null;
}

interface UpdaterActions {
  checkForUpdates: (silent?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  resetStatus: () => void;
  setUpdateAvailable: (available: boolean) => void;
}

type UpdaterStore = UpdaterState & UpdaterActions;

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: "idle",
  version: null,
  currentVersion: null,
  date: null,
  body: null,
  error: null,
  progress: 0,
  updateObj: null,

  checkForUpdates: async (silent = false) => {
    if (get().status === "checking" || get().status === "downloading") return;

    set({ status: "checking", error: null });

    try {
      const update = await check();

      if (update?.available) {
        set({
          status: "available",
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
          updateObj: update,
        });
      } else {
        set({
          status: "uptodate",
          updateObj: null,
        });
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      if (!silent) {
        set({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to check for updates",
        });
      } else {
        set({ status: "idle" });
      }
    }
  },

  installUpdate: async () => {
    const { updateObj } = get();
    if (!updateObj) return;

    set({ status: "downloading", progress: 0, error: null });

    try {
      let contentLength = 0;
      let downloaded = 0;

      await updateObj.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            console.log(`Started downloading ${contentLength} bytes`);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              set({ progress: (downloaded / contentLength) * 100 });
            }
            break;
          case "Finished":
            console.log("Download finished");
            set({ progress: 100, status: "downloaded" });
            break;
        }
      });

      console.log("Update installed, restarting...");
      await relaunch();
    } catch (err) {
      console.error("Failed to install update:", err);
      set({
        status: "error",
        error: "Failed to install update. Please try again.",
        progress: 0,
      });
    }
  },

  resetStatus: () => {
    set({
      status: "idle",
      error: null,
      progress: 0,
    });
  },

  setUpdateAvailable: (available) => {
     if (available) {
         // This is a helper if we ever need to manually trigger this state, 
         // though checkForUpdates is preferred.
         // Keeping it for potential external triggers.
     }
  }
}));