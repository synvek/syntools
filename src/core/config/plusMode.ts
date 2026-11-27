/**
 * 构建期功能开关：服务端增强能力（PLUS）。
 *
 * `PLUS_MODE=true` 时启用需要后端的特性——目前是 `/api/ip-info` Pages Function
 * 背后的「IP 归属地」工具。其余功能都是纯前端，因此开关**默认关闭**：
 * 本地 dev、GitHub Pages 与 Tauri 单机版完全不受影响（注册表里不会多出这个工具，
 * 页面也不会发出任何额外请求）。
 *
 * 为什么读 `import.meta.env` 而不是注入 `define`：SEO 预渲染插件用自己的内联
 * Vite server（`configFile: false`）加载注册表，`define` 的值不会生效；而
 * `VITE_PLUS_MODE` 走的是进程环境变量，两条构建链路读到的是同一个值，
 * 于是预渲染的 sitemap 和客户端 bundle 不会互相矛盾。
 */
const RAW = import.meta.env.VITE_PLUS_MODE;

/** 是否启用 PLUS 模式（构建期常量，运行期不可改变） */
export const PLUS_MODE = /^(1|true|yes|on)$/i.test((RAW ?? '').trim());
