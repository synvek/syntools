# SynTools 工具扩充（41 个新工具 + 3 个新分类）

## 目标

在现有 111 个工具基础上补齐竞品差距，工具总数达到 **152 个**，同时新增 `file` / `media` / `cheatsheet` 三个分类。

## 批次

| #   | 批次                         | 工具                                                                                                                                    | 状态    |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0   | 基座：新分类 + i18n 注入工具 | —                                                                                                                                       | pending |
| 1   | 网络 8 个                    | ip-calc, mac-address, url-parser, ua-generator, http-headers, http-request, websocket-tester, random-port                               | pending |
| 2   | PDF 4 个                     | pdf-compress, pdf-extract-text, pdf-decrypt, pdf-watermark                                                                              | pending |
| 3   | 编码 5 个                    | base-encoding, morse-code, caesar-cipher, escape-unescape, encoding-rescue                                                              | pending |
| 4   | 加密 5 个                    | rsa-crypto, key-converter, password-hash, checksum, password-strength                                                                   | pending |
| 5   | 格式化/生成器 4 个           | csv-tool, code-minify, id-generator, barcode                                                                                            | pending |
| 6   | 文件 3 个                    | zip-manager, file-split-merge, bulk-rename                                                                                              | pending |
| 7   | 音视频 3 个                  | audio-convert, video-to-gif, subtitle-tool                                                                                              | pending |
| 8   | 图片/日常/速查 9 个          | image-grid-cut, id-photo, image-ascii, unit-converter, timezone-converter, tax-loan-calculator, http-status, mime-types, git-cheatsheet | pending |
| 9   | 收尾：README、预算、全量门禁 | —                                                                                                                                       | pending |

## 关键技术决策

- zh / en 两个 locale 是**同步加载进首屏**的（见 `src/core/i18n/locales/index.ts`），其余 7 语按需 import；新增工具文案主要冲击首屏 185KB 预算，收尾时按实测调整。
- i18n 键：`toolsMeta.<id>.{name,description}`、`tools.<id>.*`、`categories.<id>`；缺失时回退到 `ToolMeta` 内联中文。
- 文案批量注入走 `scripts/inject-tool-locales.mjs` + `scripts/tool-locales/*.json`，避免手工编辑 369 处。
- ffmpeg.wasm 采用单线程版 + Worker 隔离，不启用全站 COOP/COEP（避免影响第三方资源）。

## Errors Encountered

| Error | Attempt | Resolution |
| ----- | ------- | ---------- |
