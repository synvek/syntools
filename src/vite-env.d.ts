/// <reference types="vite/client" />

/** App version, injected at build time by vite.config.ts from package.json */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /**
   * First-party analytics endpoint (optional). Empty disables analytics entirely with zero requests.
   * Must share the site's origin, otherwise relax CSP connect-src too (see public/_headers and vercel.json).
   */
  readonly VITE_ANALYTICS_ENDPOINT?: string;

  /**
   * PLUS 模式（默认关闭）：启用依赖服务端的能力，目前是 `/api/ip-info` 背后的
   * 「IP 归属地」工具。由 `PLUS_MODE=true` 构建时注入（见 build:cf 与
   * src/core/config/plusMode.ts）；纯静态/单机构建保持关闭。
   */
  readonly VITE_PLUS_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
