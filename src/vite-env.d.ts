/// <reference types="vite/client" />

/** App version, injected at build time by vite.config.ts from package.json */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /**
   * First-party analytics endpoint (optional). Empty disables analytics entirely with zero requests.
   * Must share the site's origin, otherwise relax CSP connect-src too (see public/_headers and vercel.json).
   */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
