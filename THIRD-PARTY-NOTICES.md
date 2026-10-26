# 第三方组件与许可声明（Third-Party Notices）

本文件列出 **SynTools 0.8.2** 随附或随包发布的第三方组件及其许可，
适用于网页版产物、桌面安装包（Tauri）与企业服务器版的部署包。

本项目自身以 **AGPL-3.0-only** 发布（见 `LICENSE`）。如果你购买的是商业许可版本，
本文件中的声明依然适用：它们约束的是第三方组件，不因本项目如何授权而改变。

> 本文件由 `pnpm notices` 生成，请勿手工修改。数据来源：
> 运行时 npm 依赖（`pnpm licenses ls --prod --json`，不含 devDependencies）与 `src-tauri/Cargo.lock`。

## 一、总览

| 范围 | 组件数 | 说明 |
| --- | --- | --- |
| 运行时 npm 依赖 | 535 | 会随构建产物发布的包（去重后按包名统计） |
| Rust crate（桌面版） | 375 + 64 个本地未缓存 | Tauri 应用二进制中包含的 crate |

所有组件的许可均属于宽松许可、文件级 copyleft 或字体许可，**没有 GPL / AGPL / SSPL / 非商业许可**。
CI 用 `pnpm license:check`（npm）与 `cargo deny check licenses`（Rust）守这条线。

## 二、npm 运行时依赖的许可分布

| 许可 | 包数 |
| --- | --- |
| MIT | 375 |
| ISC | 64 |
| Apache-2.0 | 45 |
| BSD-3-Clause | 25 |
| BlueOak-1.0.0 | 6 |
| BSD-2-Clause | 4 |
| Unknown | 3 |
| Unlicense | 2 |
| MIT/X11 | 2 |
| CC0-1.0 | 2 |
| Python-2.0 | 1 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| BSD | 1 |
| (MIT OR GPL-3.0-or-later) | 1 |
| MPL-2.0 | 1 |
| (MIT AND Zlib) | 1 |
| 0BSD | 1 |

## 三、需要特别说明的义务

### mediabunny — MPL-2.0（文件级 copyleft）

音视频工具用 mediabunny 做容器解封装/封装。MPL-2.0 的义务只落在**被修改的文件**上：
本项目未修改其源码，因此闭源分发无需公开任何代码；一旦修改，必须公开该文件的改动。
许可证全文：https://mozilla.org/MPL/2.0/

### KaTeX 字体 — SIL OFL-1.1

数学公式工具随包分发 KaTeX 的 59 个字体文件（woff/woff2/ttf），许可为 SIL Open Font License 1.1。
OFL 允许商用、嵌入与再分发，但**不得单独售卖字体本身**，且不得在修改后继续使用保留字体名（Reserved Font Name）。
本项目原样分发、未做任何字形修改，字体名保持不变。
许可证全文：https://openfontlicense.org/open-font-license-official-text/

### Apache-2.0 组件

Apache-2.0 要求保留版权与许可声明，并附带专利授权（第 3 条）。分发时保留各包的 NOTICE 内容即可。
许可证全文：https://www.apache.org/licenses/LICENSE-2.0

### 已移除的组件（许可原因）

| 组件 | 原许可 | 处理 | 原因 |
| --- | --- | --- | --- |
| `@ffmpeg/core-mt` / `@ffmpeg/ffmpeg` | GPL-2.0-or-later（发布的是带 `--enable-gpl --enable-libx264 --enable-libx265` 的构建） | 已移除，媒体处理改为 WebCodecs + mediabunny | 随闭源的商业版本分发会触发 GPL 的源码开放义务 |
| `ua-parser-js@2` | AGPL-3.0-or-later | 降级到 `1.0.41`（MIT） | 同上；该工具只用到 v1 就有的 API |

当前依赖树中**不存在 GPL / AGPL / SSPL / Commons Clause / 非商业许可**组件，由 `pnpm license:check` 与 `cargo deny` 在 CI 中强制校验。

### 双许可组件的取值声明

| 组件 | 声明许可 | 本项目选择的许可 |
| --- | --- | --- |
| jszip | MIT OR GPL-3.0-or-later | **MIT** |
| dompurify | MPL-2.0 OR Apache-2.0 | **Apache-2.0** |

`pako` 声明为 `MIT AND Zlib`，两者义务同类且均为宽松许可，随包附带的 LICENSE 同时满足两条。

### package.json 未声明许可的包

| 组件 | 处理 |
| --- | --- |
| buffers | 包内 LICENSE 为 MIT（package.json 未填写 license 字段） |
| khroma | 包内 LICENSE 为 MIT（package.json 未填写 license 字段） |
| @univerjs/telemetry | 仅出现在 lockfile 的 peer 条目中，未安装、未进入产物 |

## 四、npm 运行时依赖清单

<details>
<summary>展开全部 535 个包</summary>

| 包 | 版本 | 许可 | 声明选择 |
| --- | --- | --- | --- |
| @antfu/install-pkg | 1.1.0 | MIT |  |
| @babel/runtime | 7.29.7 | MIT |  |
| @braintree/sanitize-url | 7.1.2 | MIT |  |
| @cantoo/pdf-lib | 2.9.1 | MIT |  |
| @chevrotain/types | 11.1.2 | Apache-2.0 |  |
| @dagrejs/dagre | 3.1.1 | MIT |  |
| @dagrejs/graphlib | 4.0.5 | MIT |  |
| @fast-csv/format | 4.3.5 | MIT |  |
| @fast-csv/parse | 4.3.6 | MIT |  |
| @flatten-js/interval-tree | 1.1.3 | MIT |  |
| @floating-ui/core | 1.8.0 | MIT |  |
| @floating-ui/dom | 1.8.0 | MIT |  |
| @floating-ui/react-dom | 2.1.9 | MIT |  |
| @floating-ui/utils | 0.2.12 | MIT |  |
| @grpc/grpc-js | 1.14.4 | Apache-2.0 |  |
| @grpc/proto-loader | 0.8.1 | Apache-2.0 |  |
| @iconify/types | 2.0.0 | MIT |  |
| @iconify/utils | 3.1.4 | MIT |  |
| @js-sdsl/ordered-map | 4.4.2 | MIT |  |
| @mermaid-js/parser | 1.2.1 | MIT |  |
| @napi-rs/canvas | 1.0.8 | MIT |  |
| @napi-rs/canvas-darwin-arm64 | 1.0.8 | MIT |  |
| @nodable/entities | 3.0.0 | MIT |  |
| @one-ini/wasm | 0.2.1 | MIT |  |
| @pdf-lib/standard-fonts | 1.0.0 | MIT |  |
| @pdf-lib/upng | 1.0.1 | MIT |  |
| @protobufjs/aspromise | 1.1.2 | BSD-3-Clause |  |
| @protobufjs/base64 | 1.1.2 | BSD-3-Clause |  |
| @protobufjs/codegen | 2.0.5 | BSD-3-Clause |  |
| @protobufjs/eventemitter | 1.1.1 | BSD-3-Clause |  |
| @protobufjs/fetch | 1.1.1 | BSD-3-Clause |  |
| @protobufjs/float | 1.0.2 | BSD-3-Clause |  |
| @protobufjs/path | 1.1.2 | BSD-3-Clause |  |
| @protobufjs/pool | 1.1.0 | BSD-3-Clause |  |
| @protobufjs/utf8 | 1.1.2 | BSD-3-Clause |  |
| @radix-ui/primitive | 1.1.7 | MIT |  |
| @radix-ui/react-arrow | 1.1.15 | MIT |  |
| @radix-ui/react-collection | 1.1.15 | MIT |  |
| @radix-ui/react-compose-refs | 1.1.5 | MIT |  |
| @radix-ui/react-context | 1.2.2 | MIT |  |
| @radix-ui/react-dialog | 1.1.23 | MIT |  |
| @radix-ui/react-direction | 1.1.4 | MIT |  |
| @radix-ui/react-dismissable-layer | 1.1.19 | MIT |  |
| @radix-ui/react-dropdown-menu | 2.1.24 | MIT |  |
| @radix-ui/react-focus-guards | 1.1.6 | MIT |  |
| @radix-ui/react-focus-scope | 1.1.16 | MIT |  |
| @radix-ui/react-hover-card | 1.1.23 | MIT |  |
| @radix-ui/react-id | 1.1.4 | MIT |  |
| @radix-ui/react-menu | 2.1.24 | MIT |  |
| @radix-ui/react-popover | 1.1.23 | MIT |  |
| @radix-ui/react-popper | 1.3.7 | MIT |  |
| @radix-ui/react-portal | 1.1.17 | MIT |  |
| @radix-ui/react-presence | 1.1.10 | MIT |  |
| @radix-ui/react-primitive | 2.1.10 | MIT |  |
| @radix-ui/react-roving-focus | 1.1.19 | MIT |  |
| @radix-ui/react-separator | 1.1.15 | MIT |  |
| @radix-ui/react-slot | 1.3.3 | MIT |  |
| @radix-ui/react-use-callback-ref | 1.1.4 | MIT |  |
| @radix-ui/react-use-controllable-state | 1.2.6 | MIT |  |
| @radix-ui/react-use-effect-event | 0.0.5 | MIT |  |
| @radix-ui/react-use-is-hydrated | 0.1.3 | MIT |  |
| @radix-ui/react-use-layout-effect | 1.1.4 | MIT |  |
| @radix-ui/react-use-rect | 1.1.4 | MIT |  |
| @radix-ui/react-use-size | 1.1.4 | MIT |  |
| @radix-ui/rect | 1.1.3 | MIT |  |
| @tiptap/core | 3.31.3 | MIT |  |
| @tiptap/extension-blockquote | 3.31.3 | MIT |  |
| @tiptap/extension-bold | 3.31.3 | MIT |  |
| @tiptap/extension-bubble-menu | 3.31.3 | MIT |  |
| @tiptap/extension-bullet-list | 3.31.3 | MIT |  |
| @tiptap/extension-code | 3.31.3 | MIT |  |
| @tiptap/extension-code-block | 3.31.3 | MIT |  |
| @tiptap/extension-color | 3.31.3 | MIT |  |
| @tiptap/extension-document | 3.31.3 | MIT |  |
| @tiptap/extension-dropcursor | 3.31.3 | MIT |  |
| @tiptap/extension-floating-menu | 3.31.3 | MIT |  |
| @tiptap/extension-gapcursor | 3.31.3 | MIT |  |
| @tiptap/extension-hard-break | 3.31.3 | MIT |  |
| @tiptap/extension-heading | 3.31.3 | MIT |  |
| @tiptap/extension-highlight | 3.31.3 | MIT |  |
| @tiptap/extension-horizontal-rule | 3.31.3 | MIT |  |
| @tiptap/extension-image | 3.31.3 | MIT |  |
| @tiptap/extension-italic | 3.31.3 | MIT |  |
| @tiptap/extension-link | 3.31.3 | MIT |  |
| @tiptap/extension-list | 3.31.3 | MIT |  |
| @tiptap/extension-list-item | 3.31.3 | MIT |  |
| @tiptap/extension-list-keymap | 3.31.3 | MIT |  |
| @tiptap/extension-ordered-list | 3.31.3 | MIT |  |
| @tiptap/extension-paragraph | 3.31.3 | MIT |  |
| @tiptap/extension-placeholder | 3.31.3 | MIT |  |
| @tiptap/extension-strike | 3.31.3 | MIT |  |
| @tiptap/extension-table | 3.31.3 | MIT |  |
| @tiptap/extension-table-cell | 3.31.3 | MIT |  |
| @tiptap/extension-table-header | 3.31.3 | MIT |  |
| @tiptap/extension-table-row | 3.31.3 | MIT |  |
| @tiptap/extension-task-item | 3.31.3 | MIT |  |
| @tiptap/extension-task-list | 3.31.3 | MIT |  |
| @tiptap/extension-text | 3.31.3 | MIT |  |
| @tiptap/extension-text-align | 3.31.3 | MIT |  |
| @tiptap/extension-text-style | 3.31.3 | MIT |  |
| @tiptap/extension-underline | 3.31.3 | MIT |  |
| @tiptap/extensions | 3.31.3 | MIT |  |
| @tiptap/pm | 3.31.3 | MIT |  |
| @tiptap/react | 3.31.3 | MIT |  |
| @tiptap/starter-kit | 3.31.3 | MIT |  |
| @types/d3 | 7.4.3 | MIT |  |
| @types/d3-array | 3.2.2 | MIT |  |
| @types/d3-axis | 3.0.6 | MIT |  |
| @types/d3-brush | 3.0.6 | MIT |  |
| @types/d3-chord | 3.0.6 | MIT |  |
| @types/d3-color | 3.1.3 | MIT |  |
| @types/d3-contour | 3.0.6 | MIT |  |
| @types/d3-delaunay | 6.0.4 | MIT |  |
| @types/d3-dispatch | 3.0.7 | MIT |  |
| @types/d3-drag | 3.0.7 | MIT |  |
| @types/d3-dsv | 3.0.7 | MIT |  |
| @types/d3-ease | 3.0.2 | MIT |  |
| @types/d3-fetch | 3.0.7 | MIT |  |
| @types/d3-force | 3.0.10 | MIT |  |
| @types/d3-format | 3.0.4 | MIT |  |
| @types/d3-geo | 3.1.1 | MIT |  |
| @types/d3-hierarchy | 3.1.7 | MIT |  |
| @types/d3-interpolate | 3.0.4 | MIT |  |
| @types/d3-path | 3.1.1 | MIT |  |
| @types/d3-polygon | 3.0.2 | MIT |  |
| @types/d3-quadtree | 3.0.6 | MIT |  |
| @types/d3-random | 3.0.4 | MIT |  |
| @types/d3-scale | 4.0.9 | MIT |  |
| @types/d3-scale-chromatic | 3.1.0 | MIT |  |
| @types/d3-selection | 3.0.11 | MIT |  |
| @types/d3-shape | 3.2.0 | MIT |  |
| @types/d3-time | 3.0.4 | MIT |  |
| @types/d3-time-format | 4.0.3 | MIT |  |
| @types/d3-timer | 3.0.2 | MIT |  |
| @types/d3-transition | 3.0.9 | MIT |  |
| @types/d3-zoom | 3.0.8 | MIT |  |
| @types/dom-mediacapture-transform | 0.1.12 | MIT |  |
| @types/dom-webcodecs | 0.1.13 | MIT |  |
| @types/geojson | 7946.0.16 | MIT |  |
| @types/node | 14.18.63, 18.19.130, 22.20.1, 25.9.6 | MIT |  |
| @types/pako | 2.0.4 | MIT |  |
| @types/prop-types | 15.7.15 | MIT |  |
| @types/raf | 3.4.3 | MIT |  |
| @types/react | 18.3.31 | MIT |  |
| @types/react-dom | 18.3.7 | MIT |  |
| @types/trusted-types | 2.0.7 | MIT |  |
| @types/use-sync-external-store | 0.0.6 | MIT |  |
| @univerjs/core | 0.25.1 | Apache-2.0 |  |
| @univerjs/data-validation | 0.25.1 | Apache-2.0 |  |
| @univerjs/design | 0.25.1 | Apache-2.0 |  |
| @univerjs/docs | 0.25.1 | Apache-2.0 |  |
| @univerjs/docs-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/drawing | 0.25.1 | Apache-2.0 |  |
| @univerjs/engine-formula | 0.25.1 | Apache-2.0 |  |
| @univerjs/engine-render | 0.25.1 | Apache-2.0 |  |
| @univerjs/find-replace | 0.25.1 | Apache-2.0 |  |
| @univerjs/icons | 1.4.0 | MIT |  |
| @univerjs/protocol | 0.25.1 | Apache-2.0 |  |
| @univerjs/rpc | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-conditional-formatting | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-conditional-formatting-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-data-validation | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-data-validation-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-filter | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-filter-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-find-replace | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-formula | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-formula-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-hyper-link | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-hyper-link-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-numfmt | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-numfmt-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-sort | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-sort-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/sheets-ui | 0.25.1 | Apache-2.0 |  |
| @univerjs/telemetry | 0.25.1 | Unknown（见上表） |  |
| @univerjs/themes | 0.25.1 | Apache-2.0 |  |
| @univerjs/ui | 0.25.1 | Apache-2.0 |  |
| @upsetjs/venn.js | 2.0.0 | MIT |  |
| @wendellhu/redi | 1.1.1 | MIT |  |
| @xmldom/xmldom | 0.8.15 | MIT |  |
| @xyflow/react | 12.11.6 | MIT |  |
| @xyflow/system | 0.0.82 | MIT |  |
| abbrev | 5.0.0 | ISC |  |
| ag-psd | 31.0.2 | MIT |  |
| ansi-regex | 5.0.1 | MIT |  |
| ansi-styles | 4.3.0 | MIT |  |
| anynum | 1.0.1 | MIT |  |
| archiver | 5.3.2 | MIT |  |
| archiver-utils | 2.1.0, 3.0.4 | MIT |  |
| argparse | 1.0.10 | MIT |  |
| argparse | 2.0.1 | Python-2.0 |  |
| aria-hidden | 1.2.6 | MIT |  |
| async | 3.2.6 | MIT |  |
| async-lock | 1.4.1 | MIT |  |
| balanced-match | 1.0.2, 4.0.4 | MIT |  |
| base64-arraybuffer | 1.0.2 | MIT |  |
| base64-js | 1.5.1 | MIT |  |
| big-integer | 1.6.52 | Unlicense |  |
| binary | 0.3.0 | MIT |  |
| bl | 4.1.0 | MIT |  |
| bluebird | 3.4.7 | MIT |  |
| brace-expansion | 1.1.18, 2.1.4, 5.0.9 | MIT |  |
| buffer | 5.7.1 | MIT |  |
| buffer-crc32 | 0.2.13 | MIT |  |
| buffer-indexof-polyfill | 1.0.2 | MIT |  |
| buffers | 0.1.1 | Unknown（见上表） |  |
| camelcase | 5.3.1 | MIT |  |
| canvg | 3.0.11 | MIT |  |
| chainsaw | 0.1.0 | MIT/X11 |  |
| chinese-conv | 4.0.0 | MIT |  |
| cjk-regex | 3.4.2 | MIT |  |
| class-variance-authority | 0.7.1 | Apache-2.0 |  |
| classcat | 5.0.5 | MIT |  |
| cliui | 6.0.0, 8.0.1 | ISC |  |
| clsx | 2.1.1 | MIT |  |
| codejar | 4.3.0 | MIT |  |
| collapse-white-space | 2.1.0 | MIT |  |
| color | 4.2.3 | MIT |  |
| color-convert | 2.0.1 | MIT |  |
| color-name | 1.1.4 | MIT |  |
| color-string | 1.9.1 | MIT |  |
| commander | 14.0.3, 15.0.0, 2.20.3, 7.2.0, 8.3.0 | MIT |  |
| compress-commons | 4.1.2 | MIT |  |
| concat-map | 0.0.1 | MIT |  |
| config-chain | 1.1.13 | MIT |  |
| cookie | 1.1.1 | MIT |  |
| core-js | 3.50.0 | MIT |  |
| core-util-is | 1.0.3 | MIT |  |
| cose-base | 1.0.3, 2.2.0 | MIT |  |
| crc-32 | 1.2.2 | Apache-2.0 |  |
| crc32-stream | 4.0.3 | MIT |  |
| cron-parser | 5.10.0 | MIT |  |
| css-line-break | 2.1.0 | MIT |  |
| css-tree | 2.2.1 | MIT |  |
| csso | 5.0.5 | MIT |  |
| csstype | 3.2.3 | MIT |  |
| cytoscape | 3.34.2 | MIT |  |
| cytoscape-cose-bilkent | 4.1.0 | MIT |  |
| cytoscape-fcose | 2.2.0 | MIT |  |
| d3 | 7.9.0 | ISC |  |
| d3-array | 2.12.1 | BSD-3-Clause |  |
| d3-array | 3.2.4 | ISC |  |
| d3-axis | 3.0.0 | ISC |  |
| d3-brush | 3.0.0 | ISC |  |
| d3-chord | 3.0.1 | ISC |  |
| d3-color | 3.1.0 | ISC |  |
| d3-contour | 4.0.2 | ISC |  |
| d3-delaunay | 6.0.4 | ISC |  |
| d3-dispatch | 3.0.1 | ISC |  |
| d3-drag | 3.0.0 | ISC |  |
| d3-dsv | 3.0.1 | ISC |  |
| d3-ease | 3.0.1 | BSD-3-Clause |  |
| d3-fetch | 3.0.1 | ISC |  |
| d3-force | 3.0.0 | ISC |  |
| d3-format | 3.1.2 | ISC |  |
| d3-geo | 3.1.1 | ISC |  |
| d3-hierarchy | 3.1.2 | ISC |  |
| d3-interpolate | 3.0.1 | ISC |  |
| d3-path | 1.0.9 | BSD-3-Clause |  |
| d3-path | 3.1.0 | ISC |  |
| d3-polygon | 3.0.1 | ISC |  |
| d3-quadtree | 3.0.1 | ISC |  |
| d3-random | 3.0.1 | ISC |  |
| d3-sankey | 0.12.3 | BSD-3-Clause |  |
| d3-scale | 4.0.2 | ISC |  |
| d3-scale-chromatic | 3.1.0 | ISC |  |
| d3-selection | 3.0.0 | ISC |  |
| d3-shape | 1.3.7 | BSD-3-Clause |  |
| d3-shape | 3.2.0 | ISC |  |
| d3-time | 3.1.0 | ISC |  |
| d3-time-format | 4.1.0 | ISC |  |
| d3-timer | 3.0.1 | ISC |  |
| d3-transition | 3.0.1 | ISC |  |
| d3-zoom | 3.0.0 | ISC |  |
| dagre-d3-es | 7.0.14 | MIT |  |
| dayjs | 1.11.23 | MIT |  |
| decamelize | 1.2.0 | MIT |  |
| decimal.js | 10.6.0 | MIT |  |
| delaunator | 5.1.0 | ISC |  |
| detect-node-es | 1.1.0 | MIT |  |
| diff | 8.0.4 | BSD-3-Clause |  |
| dijkstrajs | 1.0.3 | MIT |  |
| dingbat-to-unicode | 1.0.1 | BSD-2-Clause |  |
| discontinuous-range | 1.0.0 | MIT |  |
| docx | 9.7.1 | MIT |  |
| dom-helpers | 5.2.1 | MIT |  |
| dompurify | 3.4.14 | (MPL-2.0 OR Apache-2.0) | Apache-2.0 |
| duck | 0.1.12 | BSD |  |
| duplexer2 | 0.1.4 | BSD-3-Clause |  |
| echarts | 5.6.0 | Apache-2.0 |  |
| editorconfig | 3.0.2 | MIT |  |
| emoji-regex | 8.0.0 | MIT |  |
| end-of-stream | 1.4.5 | MIT |  |
| es-toolkit | 1.52.0 | MIT |  |
| escalade | 3.2.0 | MIT |  |
| exceljs | 4.4.0 | MIT |  |
| fast-csv | 4.3.6 | MIT |  |
| fast-diff | 1.3.0 | Apache-2.0 |  |
| fast-equals | 5.4.2 | MIT |  |
| fast-png | 6.4.0 | MIT |  |
| fast-xml-builder | 1.3.1 | MIT |  |
| fast-xml-parser | 5.11.1 | MIT |  |
| fastdom | 1.0.12 | MIT |  |
| fflate | 0.8.3 | MIT |  |
| find-up | 4.1.0 | MIT |  |
| franc-min | 6.2.0 | MIT |  |
| fs-constants | 1.0.0 | MIT |  |
| fs.realpath | 1.0.0 | ISC |  |
| fstream | 1.0.12 | ISC |  |
| get-caller-file | 2.0.5 | ISC |  |
| get-nonce | 1.0.1 | MIT |  |
| gifuct-js | 2.1.2 | MIT |  |
| glob | 7.2.3 | ISC |  |
| glob | 13.0.6 | BlueOak-1.0.0 |  |
| graceful-fs | 4.2.11 | ISC |  |
| hachure-fill | 0.5.2 | MIT |  |
| hash.js | 1.1.7 | MIT |  |
| html-entities | 2.6.0 | MIT |  |
| html-parse-stringify | 4.0.1 | MIT |  |
| html-to-image | 1.11.13 | MIT |  |
| html2canvas | 1.4.1 | MIT |  |
| https | 1.0.0 | ISC |  |
| i18next | 26.4.0 | MIT |  |
| iconv-lite | 0.6.3 | MIT |  |
| ieee754 | 1.2.1 | BSD-3-Clause |  |
| image-size | 1.2.1 | MIT |  |
| immediate | 3.0.6 | MIT |  |
| import-meta-resolve | 4.2.0 | MIT |  |
| inflight | 1.0.6 | ISC |  |
| inherits | 2.0.4 | ISC |  |
| ini | 1.3.8 | ISC |  |
| internmap | 1.0.1, 2.0.3 | ISC |  |
| iobuffer | 5.4.0 | MIT |  |
| is-arrayish | 0.3.4 | MIT |  |
| is-fullwidth-code-point | 3.0.0 | MIT |  |
| is-unsafe | 2.0.2 | MIT |  |
| isarray | 1.0.0 | MIT |  |
| js-beautify | 2.0.3 | MIT |  |
| js-binary-schema-parser | 2.0.3 | MIT |  |
| js-cookie | 3.0.8 | MIT |  |
| js-md5 | 0.8.3 | MIT |  |
| js-tokens | 4.0.0 | MIT |  |
| jspdf | 4.2.1 | MIT |  |
| jsqr | 1.4.0 | Apache-2.0 |  |
| jszip | 3.10.1 | (MIT OR GPL-3.0-or-later) | MIT |
| katex | 0.16.47, 0.18.5 | MIT |  |
| kdbush | 4.1.0 | ISC |  |
| khroma | 2.1.0 | Unknown（见上表） |  |
| konva | 9.3.22 | MIT |  |
| layout-base | 1.0.2, 2.0.1 | MIT |  |
| lazystream | 1.0.1 | MIT |  |
| lie | 3.1.1, 3.3.0 | MIT |  |
| linkifyjs | 4.3.3 | MIT |  |
| listenercount | 1.0.1 | ISC |  |
| localforage | 1.10.0 | Apache-2.0 |  |
| locate-path | 5.0.0 | MIT |  |
| lodash-es | 4.18.1 | MIT |  |
| lodash.camelcase | 4.3.0 | MIT |  |
| lodash.defaults | 4.2.0 | MIT |  |
| lodash.difference | 4.5.0 | MIT |  |
| lodash.escaperegexp | 4.1.2 | MIT |  |
| lodash.flatten | 4.4.0 | MIT |  |
| lodash.groupby | 4.6.0 | MIT |  |
| lodash.isboolean | 3.0.3 | MIT |  |
| lodash.isequal | 4.5.0 | MIT |  |
| lodash.isfunction | 3.0.9 | MIT |  |
| lodash.isnil | 4.0.0 | MIT |  |
| lodash.isplainobject | 4.0.6 | MIT |  |
| lodash.isundefined | 3.0.1 | MIT |  |
| lodash.union | 4.6.0 | MIT |  |
| lodash.uniq | 4.5.0 | MIT |  |
| long | 5.3.2 | Apache-2.0 |  |
| loose-envify | 1.4.0 | MIT |  |
| lop | 0.4.2 | BSD-2-Clause |  |
| lru-cache | 11.5.2 | BlueOak-1.0.0 |  |
| lunar-javascript | 1.7.7 | MIT |  |
| luxon | 3.7.2 | MIT |  |
| mammoth | 1.12.3 | BSD-2-Clause |  |
| marked | 16.4.2, 18.0.11 | MIT |  |
| mdn-data | 2.0.28 | CC0-1.0 |  |
| mediabunny | 1.59.1 | MPL-2.0 |  |
| mermaid | 11.17.2 | MIT |  |
| minimalistic-assert | 1.0.1 | ISC |  |
| minimatch | 3.1.5, 5.1.9 | ISC |  |
| minimatch | 10.2.6 | BlueOak-1.0.0 |  |
| minimist | 1.2.8 | MIT |  |
| minipass | 7.1.3 | BlueOak-1.0.0 |  |
| mkdirp | 0.5.6 | MIT |  |
| moo | 0.5.3 | BSD-3-Clause |  |
| n-gram | 2.0.2 | MIT |  |
| nanoid | 5.1.11, 5.1.16 | MIT |  |
| nearley | 2.20.1 | MIT |  |
| node-html-better-parser | 1.5.9 | MIT |  |
| nopt | 10.0.1 | ISC |  |
| normalize-path | 3.0.0 | MIT |  |
| numfmt | 3.2.6 | MIT |  |
| object-assign | 4.1.1 | MIT |  |
| once | 1.4.0 | ISC |  |
| opentype.js | 2.0.0 | MIT |  |
| option | 0.2.4 | BSD-2-Clause |  |
| orderedmap | 2.1.1 | MIT |  |
| ot-json1 | 1.0.2 | ISC |  |
| ot-text-unicode | 4.0.0 | ISC |  |
| p-limit | 2.3.0 | MIT |  |
| p-locate | 4.1.0 | MIT |  |
| p-try | 2.2.0 | MIT |  |
| package-manager-detector | 1.8.0 | MIT |  |
| pako | 1.0.11, 2.1.0, 2.2.0, 3.0.1 | (MIT AND Zlib) |  |
| path-data-parser | 0.1.0 | MIT |  |
| path-exists | 4.0.0 | MIT |  |
| path-expression-matcher | 1.6.2 | MIT |  |
| path-is-absolute | 1.0.1 | MIT |  |
| path-scurry | 2.0.2 | BlueOak-1.0.0 |  |
| pdfjs-dist | 6.3.289 | Apache-2.0 |  |
| performance-now | 2.1.0 | MIT |  |
| pinyin-pro | 3.29.3 | MIT |  |
| pngjs | 5.0.0 | MIT |  |
| points-on-curve | 0.2.0 | MIT |  |
| points-on-path | 0.2.1 | MIT |  |
| pptxgenjs | 3.12.0 | MIT |  |
| prettier | 3.9.6 | MIT |  |
| prettier-plugin-java | 2.10.4 | Apache-2.0 |  |
| prismjs | 1.30.0 | MIT |  |
| process-nextick-args | 2.0.1 | MIT |  |
| prop-types | 15.8.1 | MIT |  |
| prosemirror-changeset | 2.4.2 | MIT |  |
| prosemirror-commands | 1.7.2 | MIT |  |
| prosemirror-dropcursor | 1.8.3 | MIT |  |
| prosemirror-gapcursor | 1.4.1 | MIT |  |
| prosemirror-history | 1.5.0 | MIT |  |
| prosemirror-inputrules | 1.5.1 | MIT |  |
| prosemirror-keymap | 1.2.3 | MIT |  |
| prosemirror-model | 1.25.11 | MIT |  |
| prosemirror-schema-list | 1.5.1 | MIT |  |
| prosemirror-state | 1.4.4 | MIT |  |
| prosemirror-tables | 1.8.5 | MIT |  |
| prosemirror-transform | 1.12.1 | MIT |  |
| prosemirror-view | 1.42.3 | MIT |  |
| proto-list | 1.2.4 | ISC |  |
| protobufjs | 7.6.6 | BSD-3-Clause |  |
| qrcode | 1.5.4 | MIT |  |
| queue | 6.0.2 | MIT |  |
| quickselect | 3.0.0 | ISC |  |
| raf | 3.4.1 | MIT |  |
| railroad-diagrams | 1.0.0 | CC0-1.0 |  |
| randexp | 0.4.6 | MIT |  |
| rbush | 4.0.1 | MIT |  |
| react | 18.3.1 | MIT |  |
| react-dom | 18.3.1 | MIT |  |
| react-i18next | 17.0.12 | MIT |  |
| react-is | 16.13.1 | MIT |  |
| react-remove-scroll | 2.7.2 | MIT |  |
| react-remove-scroll-bar | 2.3.8 | MIT |  |
| react-router | 7.18.3 | MIT |  |
| react-router-dom | 7.18.3 | MIT |  |
| react-style-singleton | 2.2.3 | MIT |  |
| react-transition-group | 4.4.5 | BSD-3-Clause |  |
| readable-stream | 2.3.8, 3.6.2 | MIT |  |
| readdir-glob | 1.1.3 | Apache-2.0 |  |
| regenerator-runtime | 0.13.11 | MIT |  |
| regexp-util | 2.0.3 | MIT |  |
| require-directory | 2.1.1 | MIT |  |
| require-main-filename | 2.0.0 | ISC |  |
| ret | 0.1.15 | MIT |  |
| rgbcolor | 1.0.1 | MIT |  |
| rimraf | 2.7.1 | ISC |  |
| robust-predicates | 3.0.3 | Unlicense |  |
| rope-sequence | 1.3.4 | MIT |  |
| roughjs | 4.6.6 | MIT |  |
| rw | 1.3.3 | BSD-3-Clause |  |
| rxjs | 7.8.2 | Apache-2.0 |  |
| safe-buffer | 5.1.2 | MIT |  |
| safer-buffer | 2.1.2 | MIT |  |
| sax | 1.6.1 | BlueOak-1.0.0 |  |
| saxes | 5.0.1 | ISC |  |
| scheduler | 0.23.2 | MIT |  |
| semver | 7.8.5 | ISC |  |
| set-blocking | 2.0.0 | ISC |  |
| set-cookie-parser | 2.7.2 | MIT |  |
| setimmediate | 1.0.5 | MIT |  |
| simple-swizzle | 0.2.4 | MIT |  |
| smol-toml | 1.8.0 | BSD-3-Clause |  |
| sonner | 2.0.8 | MIT |  |
| source-map-js | 1.2.1 | BSD-3-Clause |  |
| sprintf-js | 1.0.3 | BSD-3-Clause |  |
| sql-formatter | 15.8.2 | MIT |  |
| stackblur-canvas | 2.7.0 | MIT |  |
| strictdom | 1.0.1 | MIT |  |
| string_decoder | 1.1.1 | MIT |  |
| string-width | 4.2.3 | MIT |  |
| strip-ansi | 6.0.1 | MIT |  |
| strnum | 2.4.2 | MIT |  |
| stylis | 4.4.0 | MIT |  |
| svg-pathdata | 6.0.3 | MIT |  |
| tailwind-merge | 2.6.0 | MIT |  |
| tar-stream | 2.2.0 | MIT |  |
| text-segmentation | 1.0.3 | MIT |  |
| tinyexec | 1.3.0 | MIT |  |
| tmp | 0.2.7 | MIT |  |
| traverse | 0.3.9 | MIT/X11 |  |
| trigram-utils | 2.0.1 | MIT |  |
| ts-dedent | 2.3.0 | MIT |  |
| tslib | 2.3.0, 2.8.1 | 0BSD |  |
| typescript | 5.6.3 | Apache-2.0 |  |
| ua-parser-js | 1.0.41 | MIT |  |
| underscore | 1.13.8 | MIT |  |
| undici-types | 5.26.5, 6.21.0, 7.24.6 | MIT |  |
| unicode-regex | 4.2.3 | MIT |  |
| unicount | 1.1.0 | ISC |  |
| unzipper | 0.10.14 | MIT |  |
| use-callback-ref | 1.3.3 | MIT |  |
| use-sidecar | 1.1.3 | MIT |  |
| use-sync-external-store | 1.6.0 | MIT |  |
| util-deprecate | 1.0.2 | MIT |  |
| utrie | 1.0.2 | MIT |  |
| uuid | 14.0.2, 8.3.2 | MIT |  |
| w3c-keyname | 2.2.8 | MIT |  |
| web-tree-sitter | 0.27.0 | MIT |  |
| which-module | 2.0.1 | ISC |  |
| wrap-ansi | 6.2.0, 7.0.0 | MIT |  |
| wrappy | 1.0.2 | ISC |  |
| xml | 1.0.1 | MIT |  |
| xml-js | 1.6.11 | MIT |  |
| xml-naming | 0.3.0 | MIT |  |
| xmlbuilder | 10.1.1 | MIT |  |
| xmlchars | 2.2.0 | MIT |  |
| y18n | 4.0.3, 5.0.8 | ISC |  |
| yaml | 2.9.0 | ISC |  |
| yargs | 15.4.1, 17.7.3 | MIT |  |
| yargs-parser | 18.1.3, 21.1.1 | ISC |  |
| zip-stream | 4.1.1 | MIT |  |
| zrender | 5.6.1 | BSD-3-Clause |  |
| zustand | 4.5.7 | MIT |  |

</details>

## 五、Rust crate 清单（桌面版）

仅桌面版（Tauri）二进制包含这些 crate；网页版与企业服务器版不包含。

<details>
<summary>展开 375 个 crate 的许可分布</summary>

| 许可 | crate 数 |
| --- | --- |
| MIT OR Apache-2.0 | 180 |
| MIT | 92 |
| Apache-2.0 OR MIT | 19 |
| Unicode-3.0 | 18 |
| Zlib OR Apache-2.0 OR MIT | 16 |
| MIT/Apache-2.0 | 12 |
| Unlicense OR MIT | 5 |
| MPL-2.0 | 5 |
| Apache-2.0/MIT | 3 |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | 3 |
| BSD-3-Clause | 2 |
| MIT OR Zlib OR Apache-2.0 | 2 |
| BSD-3-Clause OR MIT OR Apache-2.0 | 2 |
| MIT OR Apache-2.0 OR LGPL-2.1-or-later | 2 |
| MIT OR Apache-2.0 OR Zlib | 2 |
| Unlicense/MIT | 2 |
| Apache-2.0 | 2 |
| 0BSD OR MIT OR Apache-2.0 | 1 |
| Apache-2.0 AND MIT | 1 |
| CC0-1.0 OR MIT-0 OR Apache-2.0 | 1 |
| Apache-2.0 / MIT | 1 |
| Zlib | 1 |
| ISC | 1 |
| Apache-2.0 WITH LLVM-exception | 1 |
| (MIT OR Apache-2.0) AND Unicode-3.0 | 1 |

</details>

<details>
<summary>展开全部 375 个 crate</summary>

| crate | 版本 | 许可 |
| --- | --- | --- |
| adler2 | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| aho-corasick | 1.1.5 | Unlicense OR MIT |
| alloc-no-stdlib | 2.0.4 | BSD-3-Clause |
| alloc-stdlib | 0.2.4 | BSD-3-Clause |
| android_log-sys | 0.3.2 | MIT OR Apache-2.0 |
| android_system_properties | 0.1.6 | MIT OR Apache-2.0 |
| anyhow | 1.0.104 | MIT OR Apache-2.0 |
| atk | 0.18.2 | MIT |
| atk-sys | 0.18.2 | MIT |
| atomic-waker | 1.1.2 | Apache-2.0 OR MIT |
| autocfg | 1.5.1 | Apache-2.0 OR MIT |
| base64 | 0.21.7 | MIT OR Apache-2.0 |
| base64 | 0.22.1 | MIT OR Apache-2.0 |
| base64 | 0.23.1 | MIT OR Apache-2.0 |
| bit-set | 0.8.0 | Apache-2.0 OR MIT |
| bit-vec | 0.8.0 | Apache-2.0 OR MIT |
| bitflags | 1.3.2 | MIT/Apache-2.0 |
| bitflags | 2.13.1 | MIT OR Apache-2.0 |
| block-buffer | 0.10.4 | MIT OR Apache-2.0 |
| block2 | 0.6.2 | MIT |
| bs58 | 0.5.1 | MIT/Apache-2.0 |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 |
| bytemuck | 1.25.2 | Zlib OR Apache-2.0 OR MIT |
| byteorder | 1.5.0 | Unlicense OR MIT |
| bytes | 1.12.1 | MIT |
| cairo-rs | 0.18.5 | MIT |
| cairo-sys-rs | 0.18.2 | MIT |
| cargo_metadata | 0.19.2 | MIT |
| cargo_toml | 0.22.3 | Apache-2.0 OR MIT |
| cargo-platform | 0.1.9 | MIT OR Apache-2.0 |
| cesu8 | 1.1.0 | Apache-2.0/MIT |
| cfb | 0.7.3 | MIT |
| cfg-expr | 0.15.8 | MIT OR Apache-2.0 |
| cfg-if | 1.0.4 | MIT OR Apache-2.0 |
| chrono | 0.4.45 | MIT OR Apache-2.0 |
| combine | 4.6.8 | MIT |
| cookie | 0.18.2 | MIT OR Apache-2.0 |
| core-foundation | 0.10.1 | MIT OR Apache-2.0 |
| core-foundation-sys | 0.8.7 | MIT OR Apache-2.0 |
| core-graphics | 0.25.0 | MIT OR Apache-2.0 |
| core-graphics-types | 0.2.0 | MIT OR Apache-2.0 |
| cpufeatures | 0.2.17 | MIT OR Apache-2.0 |
| crossbeam-channel | 0.5.17 | MIT OR Apache-2.0 |
| crossbeam-utils | 0.8.23 | MIT OR Apache-2.0 |
| crypto-common | 0.1.7 | MIT OR Apache-2.0 |
| cssparser | 0.36.0 | MPL-2.0 |
| cssparser-macros | 0.6.1 | MPL-2.0 |
| darling | 0.24.1 | MIT |
| darling_core | 0.24.1 | MIT |
| darling_macro | 0.24.1 | MIT |
| dbus | 0.9.12 | Apache-2.0/MIT |
| deranged | 0.5.8 | MIT OR Apache-2.0 |
| derive_more | 2.1.1 | MIT |
| derive_more-impl | 2.1.1 | MIT |
| digest | 0.10.7 | MIT OR Apache-2.0 |
| dirs | 6.0.0 | MIT OR Apache-2.0 |
| dirs-sys | 0.5.0 | MIT OR Apache-2.0 |
| dispatch2 | 0.3.1 | Zlib OR Apache-2.0 OR MIT |
| displaydoc | 0.2.7 | MIT OR Apache-2.0 |
| dlopen2 | 0.8.2 | MIT |
| dlopen2_derive | 0.4.3 | MIT |
| dom_query | 0.27.0 | MIT |
| dpi | 0.1.2 | Apache-2.0 AND MIT |
| dtoa | 1.0.11 | MIT OR Apache-2.0 |
| dtoa-short | 0.3.5 | MPL-2.0 |
| dunce | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 |
| dyn-clone | 1.0.20 | MIT OR Apache-2.0 |
| embed_plist | 1.2.2 | MIT OR Apache-2.0 |
| equivalent | 1.0.2 | Apache-2.0 OR MIT |
| erased-serde | 0.4.10 | MIT OR Apache-2.0 |
| fastrand | 2.5.0 | Apache-2.0 OR MIT |
| fdeflate | 0.3.7 | MIT OR Apache-2.0 |
| field-offset | 0.3.6 | MIT OR Apache-2.0 |
| flate2 | 1.1.10 | MIT OR Apache-2.0 |
| fnv | 1.0.7 | Apache-2.0 / MIT |
| foldhash | 0.2.0 | Zlib |
| foreign-types | 0.5.0 | MIT/Apache-2.0 |
| foreign-types-macros | 0.2.4 | MIT/Apache-2.0 |
| foreign-types-shared | 0.3.1 | MIT/Apache-2.0 |
| form_urlencoded | 1.2.2 | MIT OR Apache-2.0 |
| futures-channel | 0.3.34 | MIT OR Apache-2.0 |
| futures-core | 0.3.34 | MIT OR Apache-2.0 |
| futures-executor | 0.3.34 | MIT OR Apache-2.0 |
| futures-io | 0.3.34 | MIT OR Apache-2.0 |
| futures-macro | 0.3.34 | MIT OR Apache-2.0 |
| futures-sink | 0.3.34 | MIT OR Apache-2.0 |
| futures-task | 0.3.34 | MIT OR Apache-2.0 |
| futures-util | 0.3.34 | MIT OR Apache-2.0 |
| gdk | 0.18.2 | MIT |
| gdk-pixbuf | 0.18.5 | MIT |
| gdk-pixbuf-sys | 0.18.0 | MIT |
| gdk-sys | 0.18.2 | MIT |
| gdkwayland-sys | 0.18.2 | MIT |
| gdkx11 | 0.18.2 | MIT |
| gdkx11-sys | 0.18.2 | MIT |
| generic-array | 0.14.7 | MIT |
| getrandom | 0.2.17 | MIT OR Apache-2.0 |
| getrandom | 0.3.4 | MIT OR Apache-2.0 |
| getrandom | 0.4.3 | MIT OR Apache-2.0 |
| gio | 0.18.4 | MIT |
| gio-sys | 0.18.1 | MIT |
| glib | 0.18.5 | MIT |
| glib-macros | 0.18.5 | MIT |
| glib-sys | 0.18.1 | MIT |
| glob | 0.3.4 | MIT OR Apache-2.0 |
| gobject-sys | 0.18.0 | MIT |
| gtk | 0.18.2 | MIT |
| gtk-sys | 0.18.2 | MIT |
| gtk3-macros | 0.18.2 | MIT |
| hashbrown | 0.12.3 | MIT OR Apache-2.0 |
| hashbrown | 0.17.1 | MIT OR Apache-2.0 |
| heck | 0.4.1 | MIT OR Apache-2.0 |
| heck | 0.5.0 | MIT OR Apache-2.0 |
| hex | 0.4.3 | MIT OR Apache-2.0 |
| html5ever | 0.38.0 | MIT OR Apache-2.0 |
| http | 1.5.0 | MIT OR Apache-2.0 |
| http-body | 1.1.0 | MIT |
| http-body-util | 0.1.5 | MIT |
| httparse | 1.10.1 | MIT OR Apache-2.0 |
| hyper-util | 0.1.20 | MIT |
| iana-time-zone | 0.1.65 | MIT OR Apache-2.0 |
| iana-time-zone-haiku | 0.1.2 | MIT OR Apache-2.0 |
| ico | 0.5.0 | MIT |
| icu_collections | 2.3.0 | Unicode-3.0 |
| icu_locale_core | 2.3.0 | Unicode-3.0 |
| icu_normalizer | 2.3.0 | Unicode-3.0 |
| icu_normalizer_data | 2.3.0 | Unicode-3.0 |
| icu_properties | 2.3.0 | Unicode-3.0 |
| icu_properties_data | 2.3.0 | Unicode-3.0 |
| icu_provider | 2.3.1 | Unicode-3.0 |
| ident_case | 1.0.1 | MIT/Apache-2.0 |
| idna | 1.1.0 | MIT OR Apache-2.0 |
| idna_adapter | 1.2.2 | Apache-2.0 OR MIT |
| indexmap | 1.9.3 | Apache-2.0 OR MIT |
| indexmap | 2.14.2 | Apache-2.0 OR MIT |
| infer | 0.19.0 | MIT |
| ipnet | 2.12.2 | MIT OR Apache-2.0 |
| itoa | 1.0.18 | MIT OR Apache-2.0 |
| javascriptcore-rs | 1.1.2 | MIT |
| javascriptcore-rs-sys | 1.1.1 | MIT |
| jiff-tzdb-platform | 0.1.3 | Unlicense OR MIT |
| jni | 0.21.1 | MIT/Apache-2.0 |
| jni-sys | 0.3.1 | MIT OR Apache-2.0 |
| jni-sys | 0.4.1 | MIT OR Apache-2.0 |
| jni-sys-macros | 0.4.1 | MIT OR Apache-2.0 |
| keyboard-types | 0.7.0 | MIT OR Apache-2.0 |
| libappindicator | 0.9.0 | Apache-2.0 OR MIT |
| libappindicator-sys | 0.9.0 | Apache-2.0 OR MIT |
| libc | 0.2.189 | MIT OR Apache-2.0 |
| libdbus-sys | 0.2.7 | Apache-2.0/MIT |
| libloading | 0.7.4 | ISC |
| litemap | 0.8.3 | Unicode-3.0 |
| lock_api | 0.4.14 | MIT OR Apache-2.0 |
| log | 0.4.34 | MIT OR Apache-2.0 |
| markup5ever | 0.38.0 | MIT OR Apache-2.0 |
| memchr | 2.8.3 | Unlicense OR MIT |
| memoffset | 0.9.1 | MIT |
| mime | 0.3.17 | MIT OR Apache-2.0 |
| miniz_oxide | 0.8.9 | MIT OR Zlib OR Apache-2.0 |
| miniz_oxide | 0.9.1 | MIT OR Zlib OR Apache-2.0 |
| muda | 0.19.3 | Apache-2.0 OR MIT |
| ndk | 0.9.0 | MIT OR Apache-2.0 |
| ndk-sys | 0.6.0+11769913 | MIT OR Apache-2.0 |
| new_debug_unreachable | 1.0.6 | MIT |
| num_enum | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 |
| num_enum_derive | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 |
| num-conv | 0.2.2 | MIT OR Apache-2.0 |
| num-traits | 0.2.19 | MIT OR Apache-2.0 |
| objc2 | 0.6.4 | MIT |
| objc2-app-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-cloud-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-data | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-foundation | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-graphics | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-image | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-location | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-core-text | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-encode | 4.1.0 | MIT |
| objc2-exception-helper | 0.1.1 | Zlib OR Apache-2.0 OR MIT |
| objc2-foundation | 0.3.2 | MIT |
| objc2-io-surface | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-quartz-core | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-ui-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-user-notifications | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| objc2-web-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| option-ext | 0.2.0 | MPL-2.0 |
| pango | 0.18.3 | MIT |
| pango-sys | 0.18.0 | MIT |
| parking_lot | 0.12.5 | MIT OR Apache-2.0 |
| parking_lot_core | 0.9.12 | MIT OR Apache-2.0 |
| percent-encoding | 2.3.2 | MIT OR Apache-2.0 |
| phf | 0.13.1 | MIT |
| phf_codegen | 0.13.1 | MIT |
| phf_generator | 0.13.1 | MIT |
| phf_macros | 0.13.1 | MIT |
| phf_shared | 0.13.1 | MIT |
| pin-project-lite | 0.2.17 | Apache-2.0 OR MIT |
| pkg-config | 0.3.34 | MIT OR Apache-2.0 |
| plist | 1.10.1 | MIT |
| png | 0.17.16 | MIT OR Apache-2.0 |
| png | 0.18.1 | MIT OR Apache-2.0 |
| portable-atomic | 1.15.0 | Apache-2.0 OR MIT |
| portable-atomic-util | 0.2.8 | Apache-2.0 OR MIT |
| potential_utf | 0.1.6 | Unicode-3.0 |
| powerfmt | 0.2.0 | MIT OR Apache-2.0 |
| precomputed-hash | 0.1.1 | MIT |
| proc-macro-crate | 1.3.1 | MIT OR Apache-2.0 |
| proc-macro-crate | 2.0.2 | MIT OR Apache-2.0 |
| proc-macro-crate | 3.5.0 | MIT OR Apache-2.0 |
| proc-macro-error | 1.0.4 | MIT OR Apache-2.0 |
| proc-macro-error-attr | 1.0.4 | MIT OR Apache-2.0 |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quick-xml | 0.42.0 | MIT |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| r-efi | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| r-efi | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| raw-window-handle | 0.6.2 | MIT OR Apache-2.0 OR Zlib |
| redox_syscall | 0.5.18 | MIT |
| redox_users | 0.5.2 | MIT |
| ref-cast | 1.0.27 | MIT OR Apache-2.0 |
| ref-cast-impl | 1.0.27 | MIT OR Apache-2.0 |
| regex | 1.13.1 | MIT OR Apache-2.0 |
| regex-automata | 0.4.18 | MIT OR Apache-2.0 |
| regex-syntax | 0.8.11 | MIT OR Apache-2.0 |
| reqwest | 0.13.5 | MIT OR Apache-2.0 |
| rustc_version | 0.4.1 | MIT OR Apache-2.0 |
| rustc-hash | 2.1.3 | Apache-2.0 OR MIT |
| rustversion | 1.0.23 | MIT OR Apache-2.0 |
| same-file | 1.0.6 | Unlicense/MIT |
| schemars | 0.8.22 | MIT |
| schemars | 0.9.0 | MIT |
| schemars_derive | 0.8.22 | MIT |
| scopeguard | 1.2.0 | MIT OR Apache-2.0 |
| selectors | 0.36.1 | MPL-2.0 |
| semver | 1.0.28 | MIT OR Apache-2.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| serde_core | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive_internals | 0.29.1 | MIT OR Apache-2.0 |
| serde_json | 1.0.151 | MIT OR Apache-2.0 |
| serde_repr | 0.1.21 | MIT OR Apache-2.0 |
| serde_spanned | 0.6.9 | MIT OR Apache-2.0 |
| serde_spanned | 1.1.1 | MIT OR Apache-2.0 |
| serde-untagged | 0.1.9 | MIT OR Apache-2.0 |
| serialize-to-javascript | 0.1.2 | MIT OR Apache-2.0 |
| serialize-to-javascript-impl | 0.1.2 | MIT OR Apache-2.0 |
| servo_arc | 0.4.3 | MIT OR Apache-2.0 |
| sha2 | 0.10.9 | MIT OR Apache-2.0 |
| shlex | 2.0.1 | MIT OR Apache-2.0 |
| simd-adler32 | 0.3.10 | MIT |
| siphasher | 1.0.3 | MIT/Apache-2.0 |
| slab | 0.4.12 | MIT |
| socket2 | 0.6.5 | MIT OR Apache-2.0 |
| softbuffer | 0.4.8 | MIT OR Apache-2.0 |
| soup3 | 0.5.0 | MIT |
| soup3-sys | 0.5.0 | MIT |
| stable_deref_trait | 1.2.1 | MIT OR Apache-2.0 |
| string_cache | 0.9.0 | MIT OR Apache-2.0 |
| string_cache_codegen | 0.6.1 | MIT OR Apache-2.0 |
| strsim | 0.11.1 | MIT |
| syn | 1.0.109 | MIT OR Apache-2.0 |
| syn | 2.0.119 | MIT OR Apache-2.0 |
| sync_wrapper | 1.0.2 | Apache-2.0 |
| synstructure | 0.13.2 | MIT |
| system-deps | 6.2.2 | MIT OR Apache-2.0 |
| tao | 0.35.3 | Apache-2.0 |
| tao-macros | 0.1.4 | MIT OR Apache-2.0 |
| target-lexicon | 0.12.16 | Apache-2.0 WITH LLVM-exception |
| tauri-winres | 0.3.6 | MIT |
| tendril | 0.5.1 | MIT OR Apache-2.0 |
| thiserror | 1.0.69 | MIT OR Apache-2.0 |
| thiserror-impl | 1.0.69 | MIT OR Apache-2.0 |
| time | 0.3.55 | MIT OR Apache-2.0 |
| time-core | 0.1.9 | MIT OR Apache-2.0 |
| time-macros | 0.2.32 | MIT OR Apache-2.0 |
| tinystr | 0.8.4 | Unicode-3.0 |
| tinyvec_macros | 0.1.1 | MIT OR Apache-2.0 OR Zlib |
| tokio | 1.53.1 | MIT |
| tokio-util | 0.7.19 | MIT |
| toml | 0.8.2 | MIT OR Apache-2.0 |
| toml | 0.9.12+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_datetime | 0.6.3 | MIT OR Apache-2.0 |
| toml_datetime | 0.7.5+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_datetime | 1.1.1+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_edit | 0.19.15 | MIT OR Apache-2.0 |
| toml_edit | 0.20.2 | MIT OR Apache-2.0 |
| toml_edit | 0.25.13+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_parser | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_writer | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 |
| tower | 0.5.3 | MIT |
| tower-http | 0.6.11 | MIT |
| tower-layer | 0.3.3 | MIT |
| tower-service | 0.3.3 | MIT |
| tracing | 0.1.44 | MIT |
| tracing-core | 0.1.36 | MIT |
| tray-icon | 0.24.2 | MIT OR Apache-2.0 |
| try-lock | 0.2.5 | MIT |
| typeid | 1.0.3 | MIT OR Apache-2.0 |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.24 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| unicode-segmentation | 1.13.3 | MIT OR Apache-2.0 |
| url | 2.5.8 | MIT OR Apache-2.0 |
| utf8_iter | 1.0.4 | Apache-2.0 OR MIT |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| version-compare | 0.2.1 | MIT |
| vswhom | 0.1.0 | MIT |
| vswhom-sys | 0.1.3 | MIT |
| walkdir | 2.5.0 | Unlicense/MIT |
| want | 0.3.1 | MIT |
| wasi | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| wasip2 | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| wasm-streams | 0.5.0 | MIT OR Apache-2.0 |
| web_atoms | 0.2.6 | MIT OR Apache-2.0 |
| webkit2gtk | 2.0.2 | MIT |
| webkit2gtk-sys | 2.0.2 | MIT |
| webview2-com | 0.38.2 | MIT |
| webview2-com-macros | 0.8.1 | MIT |
| webview2-com-sys | 0.38.2 | MIT |
| winapi | 0.3.9 | MIT/Apache-2.0 |
| winapi-i686-pc-windows-gnu | 0.4.0 | MIT/Apache-2.0 |
| winapi-util | 0.1.11 | Unlicense OR MIT |
| winapi-x86_64-pc-windows-gnu | 0.4.0 | MIT/Apache-2.0 |
| windows | 0.61.3 | MIT OR Apache-2.0 |
| windows_aarch64_gnullvm | 0.42.2 | MIT OR Apache-2.0 |
| windows_aarch64_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_aarch64_msvc | 0.42.2 | MIT OR Apache-2.0 |
| windows_aarch64_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_gnu | 0.42.2 | MIT OR Apache-2.0 |
| windows_i686_gnu | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_msvc | 0.42.2 | MIT OR Apache-2.0 |
| windows_i686_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_gnu | 0.42.2 | MIT OR Apache-2.0 |
| windows_x86_64_gnu | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_gnullvm | 0.42.2 | MIT OR Apache-2.0 |
| windows_x86_64_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_msvc | 0.42.2 | MIT OR Apache-2.0 |
| windows_x86_64_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows-collections | 0.2.0 | MIT OR Apache-2.0 |
| windows-core | 0.61.2 | MIT OR Apache-2.0 |
| windows-core | 0.62.2 | MIT OR Apache-2.0 |
| windows-future | 0.2.1 | MIT OR Apache-2.0 |
| windows-implement | 0.60.2 | MIT OR Apache-2.0 |
| windows-interface | 0.59.3 | MIT OR Apache-2.0 |
| windows-link | 0.1.3 | MIT OR Apache-2.0 |
| windows-link | 0.2.1 | MIT OR Apache-2.0 |
| windows-numerics | 0.2.0 | MIT OR Apache-2.0 |
| windows-result | 0.3.4 | MIT OR Apache-2.0 |
| windows-result | 0.4.1 | MIT OR Apache-2.0 |
| windows-strings | 0.4.2 | MIT OR Apache-2.0 |
| windows-strings | 0.5.1 | MIT OR Apache-2.0 |
| windows-sys | 0.45.0 | MIT OR Apache-2.0 |
| windows-sys | 0.59.0 | MIT OR Apache-2.0 |
| windows-sys | 0.61.2 | MIT OR Apache-2.0 |
| windows-targets | 0.42.2 | MIT OR Apache-2.0 |
| windows-targets | 0.52.6 | MIT OR Apache-2.0 |
| windows-threading | 0.1.0 | MIT OR Apache-2.0 |
| windows-version | 0.1.7 | MIT OR Apache-2.0 |
| winnow | 0.5.40 | MIT |
| winnow | 0.7.15 | MIT |
| winnow | 1.0.4 | MIT |
| wit-bindgen | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| writeable | 0.6.4 | Unicode-3.0 |
| wry | 0.55.1 | Apache-2.0 OR MIT |
| x11 | 2.21.0 | MIT |
| x11-dl | 2.21.0 | MIT |
| yoke | 0.8.3 | Unicode-3.0 |
| yoke-derive | 0.8.2 | Unicode-3.0 |
| zerofrom | 0.1.8 | Unicode-3.0 |
| zerofrom-derive | 0.1.7 | Unicode-3.0 |
| zerotrie | 0.2.5 | Unicode-3.0 |
| zerovec | 0.11.8 | Unicode-3.0 |
| zerovec-derive | 0.11.6 | Unicode-3.0 |
| zmij | 1.0.23 | MIT |

</details>

> 另有 64 个 crate 的许可未能在本地 registry 缓存中读取（常见于尚未展开的依赖）。
> 运行 `pnpm license:check:rust` 会用 `cargo-deny` 在完整依赖图上重新校验，结论以那次为准。

## 六、许可全文

各包随源码分发的 `LICENSE` / `LICENSE.md` 文件保持原样，未做任何修改。通用许可全文可从以下地址获取：

| 许可 | 地址 |
| --- | --- |
| MIT | https://opensource.org/license/mit |
| ISC | https://opensource.org/license/isc-license-txt |
| Apache-2.0 | https://www.apache.org/licenses/LICENSE-2.0 |
| BSD-2-Clause / BSD-3-Clause | https://opensource.org/license/bsd-2-clause |
| MPL-2.0 | https://mozilla.org/MPL/2.0/ |
| SIL OFL-1.1 | https://openfontlicense.org/open-font-license-official-text/ |
| CC0-1.0 | https://creativecommons.org/publicdomain/zero/1.0/ |
| Zlib | https://opensource.org/license/zlib |
| AGPL-3.0（本项目） | https://www.gnu.org/licenses/agpl-3.0.txt |

