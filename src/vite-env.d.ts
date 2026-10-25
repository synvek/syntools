/// <reference types="vite/client" />

/** 应用版本号，构建时由 vite.config.ts 从 package.json 注入 */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /**
   * 第一方埋点上报地址（可选）。留空则埋点完全关闭、零网络请求。
   * 必须与站点同源，否则还需同步放宽 CSP 的 connect-src（见 public/_headers 与 vercel.json）。
   */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
