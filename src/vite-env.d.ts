/// <reference types="vite/client" />

import type { ElectronAPI } from "../electron/preload";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
