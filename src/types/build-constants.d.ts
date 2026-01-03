export {};

declare global {
  /**
   * Injected at dev/build time via Vite `define` in `vite.config.ts`.
   * Used for runtime verification that the UI is running the expected build.
   */
  const __APP_BUILD_ID__: string;
  const __APP_BUILD_TIME__: string;
}
