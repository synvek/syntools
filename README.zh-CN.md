# SynTools

[English](./README.md) | **简体中文**

**面向所有人的隐私优先、浏览器本地工具集 —— 开发者、办公用户与日常文档处理者皆宜。**

SynTools 把日常常用的工具收拢到同一入口：办公文档（Word / Excel / PowerPoint）、PDF 处理、图片与照片编辑、编解码、格式化、哈希、生成器等，全部在浏览器中运行。无需安装、无需账号，默认情况下**数据不会离开本机**。

您可在线使用: www.syntools.net

---

## 为什么选择 SynTools？

| 痛点                                     | SynTools 如何解决                   |
| ---------------------------------------- | ----------------------------------- |
| 工具散落在多个广告密集的网站             | 统一界面与单一搜索入口              |
| 敏感文本需上传到第三方服务器             | 默认纯前端本地计算                  |
| 常用工具反复搜索、收藏困难               | 收藏、最近使用与 ⌘K 搜索            |
| 改一个 .docx / .xlsx / .pptx 得装 Office | 浏览器内编辑器，无需安装与授权      |
| PDF、图片处理被注册和付费墙挡住          | 完整的 PDF 与图像工具集，免费且本地 |
| 合同、报表被迫上传到在线转换站           | 文件全程在本机解析与导出            |

**核心价值**

1. **隐私** — 除非工具明确需要服务端，处理均在浏览器内完成
2. **快速** — 静态站点 + 本地计算，输入即出结果
3. **一致** — 统一布局、输入输出面板、复制/下载与错误处理
4. **可扩展** — 注册表驱动的插件机制；新增工具只需一个目录 + 一行注册

### 适用人群

SynTools 从开发者工具箱起步，但早已不再只面向开发者：

- **开发者** — 编解码、格式化、正则、哈希、JWT、UUID、Cron …
- **办公与文档处理** — Word / Excel / PowerPoint 编辑器、流程图、脑图，以及完整 PDF 工具集
- **设计与图像** — 带图层与 PSD 导出的照片编辑器，图片压缩 / 裁剪 / 水印、GIF 拆帧
- **日常使用** — 计算器、单位换算、BMI、二维码、倒计时、图表生成

---

## 功能特性

- **110+ 工具**：覆盖编码、文本、格式化、加密哈希、时间日期、生成器、网络、图片、PDF、办公文档等
- **全局搜索**：`⌘/Ctrl + K`，或在非输入状态下按 `/`
- **最近使用与收藏**：保存在本机 `localStorage`
- **亮色 / 暗色主题**：默认跟随系统，刷新无闪烁
- **国际化就绪**：9 种语言 —— 简体中文 / English / 繁體中文 / 日本語 / Français / Deutsch / Italiano / Español / Português
- **工具懒加载**：应用外壳保持轻量，各工具按需加载
- **静态部署**：支持 GitHub Pages、Vercel、Cloudflare Pages 等任意静态托管
- **桌面应用**：可选 Tauri 打包（macOS / Windows / Linux）

---

## 工具分类

| 分类     | 示例                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 办公工具 | 文字处理器（.docx）、电子表格（.xlsx、公式与多工作表）、幻灯片（.pptx 与放映）、流程图（多页）、脑图（多画布）、照片编辑器（图层、蒙版、调整图层、PSD 导出）——详见[办公工具](#办公工具) |
| 编码转换 | Base64、URL 编解码、Unicode、HTML 实体、ASCII 表                                                                                                                                        |
| 文本处理 | 正则测试、文本对比、大小写转换、字数统计、拼音、简繁转换                                                                                                                                |
| 格式化   | JSON / SQL / HTML / JS / CSS / XML 格式化、Markdown 预览                                                                                                                                |
| 加密哈希 | 哈希计算、JWT 解析、密码生成                                                                                                                                                            |
| 时间日期 | 时间戳、日历、倒计时、秒表、Cron 解析/生成                                                                                                                                              |
| 生成器   | UUID、二维码、随机字符串/数字、占位图、CSS 渐变                                                                                                                                         |
| 图片处理 | 压缩、裁剪、合并、水印、GIF 帧、SVG→PNG、Base64、ICO                                                                                                                                    |
| PDF 工具 | 合并、拆分、旋转、加密、批注、图文互转、页码、签名                                                                                                                                      |
| 网络     | UA 解析                                                                                                                                                                                 |
| 其他     | 计算器、MBTI、AI 提示词、Mermaid、图表生成 …                                                                                                                                            |

完整列表见首页，或查看 `src/core/registry/index.ts`。

### 办公工具

一组持续扩充的「文档级」编辑器，全部本地运行，草稿只存在本机。

| 工具           | 路由                        | 能力要点                                                                                      |
| -------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| 文字处理器     | `/tools/rich-text-editor`   | Word `.docx` 导入导出、双模式 PDF 导出                                                        |
| 电子表格编辑器 | `/tools/spreadsheet-editor` | Excel `.xlsx` 导入导出、公式、多工作表                                                        |
| 幻灯片编辑器   | `/tools/slide-editor`       | PowerPoint `.pptx` 导入导出、Konva 画布编辑、放映                                             |
| 流程图编辑器   | `/tools/flowchart-editor`   | 图形与连线、模板、自动布局、**多页 + 缩略图总览**、PNG/SVG 导出                               |
| 脑图编辑器     | `/tools/mindmap-editor`     | 键盘优先编辑、折叠分支、主题、**多画布 + 缩略图总览**、PNG/SVG/Markdown 导出                  |
| 照片编辑器     | `/tools/photo-editor`       | 非破坏性图层（编组 / 蒙版 / 调整图层 / 智能对象）、选区裁剪、调色滤镜、历史面板、**PSD 导出** |

共同特性：草稿自动存入 `localStorage`，导出结果保持目标格式可继续编辑（`.docx` / `.xlsx` / `.pptx` / PNG·SVG / PSD）；有多页 / 多画布的编辑器另提供缩略图总览与 `Ctrl/⌘ + PageUp / PageDown` 翻页；流程图与照片编辑器还可导出可续编的工程 JSON。

---

## 技术栈

| 层级     | 选型                                  |
| -------- | ------------------------------------- |
| 语言     | TypeScript（strict）                  |
| UI       | React 18                              |
| 构建     | Vite 6                                |
| 路由     | React Router 7                        |
| 样式     | Tailwind CSS 3（`darkMode: 'class'`） |
| 状态     | Zustand                               |
| 国际化   | i18next / react-i18next               |
| 单元测试 | Vitest + Testing Library              |
| E2E      | Playwright                            |
| 包管理   | pnpm 11                               |

架构为**注册表驱动（Registry-Driven）**：侧边栏、首页卡片、搜索索引与路由均由 `src/core/registry/index.ts` 中的单一 `tools` 数组派生。

---

## 环境要求

| 依赖    | 版本                             |
| ------- | -------------------------------- |
| Node.js | ≥ 20（推荐 22.x）                |
| pnpm    | 11.x（由 `packageManager` 锁定） |

如需启用 Corepack：

```bash
corepack enable
```

---

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:9999](http://localhost:9999)。

### 常用脚本

| 命令                | 说明                           |
| ------------------- | ------------------------------ |
| `pnpm dev`          | 启动 Vite 开发服务器           |
| `pnpm build`        | 类型检查（`tsc -b`）+ 生产构建 |
| `pnpm preview`      | 本地预览生产构建产物           |
| `pnpm test`         | 运行单元测试（Vitest）         |
| `pnpm test:watch`   | Vitest 监听模式                |
| `pnpm e2e`          | 运行 Playwright 端到端测试     |
| `pnpm lint`         | ESLint 检查（零警告策略）      |
| `pnpm lint:fix`     | ESLint 自动修复                |
| `pnpm format`       | Prettier 格式化写入            |
| `pnpm format:check` | Prettier 检查                  |
| `pnpm typecheck`    | 仅 TypeScript 类型检查         |
| `pnpm size`         | 包体积预算检查                 |

提交前钩子（Husky + lint-staged）会对暂存文件执行 `eslint --fix` 与 `prettier --write`。

---

## 项目结构

```
syntools/
├── index.html                 # 入口 + 内联主题初始化（防首帧闪烁）
├── vite.config.ts             # Vite + Vitest（@ → src）
├── vercel.json                # SPA 重写 + 安全响应头
└── src/
    ├── main.tsx
    ├── app/                   # 应用外壳：布局、首页、搜索、路由
    ├── core/                  # 类型、注册表、通用 UI、hooks、PDF 辅助
    ├── stores/                # 主题、最近使用、收藏
    └── tools/                 # 每个工具一个目录
        ├── _template/         # 可复制的起步模板
        └── <tool-id>/
            ├── index.ts       # ToolMeta
            ├── *Tool.tsx      # 懒加载 UI
            ├── core.ts        # 纯函数逻辑（ToolResult）
            └── core.test.ts
```

---

## 新增工具

1. 将 `src/tools/_template` 复制为 `src/tools/<your-id>`。
2. 在 `core.ts` 中实现返回 `ToolResult<T>` 的纯函数（预期错误不要抛异常）：

   ```ts
   type ToolResult<T> = { ok: true; value: T } | { ok: false; error: string };
   ```

3. 在 `index.ts` 填写 `ToolMeta`（`id`、`name`、`description`、`category`、`keywords`、`icon`、懒加载 `component`）。
4. 使用通用组件构建 UI（`IOTextArea`、`CopyButton`、`FileDropZone` 等）。
5. 在 `src/core/registry/index.ts` 追加一行注册。
6. 补充 `core.test.ts`（核心逻辑覆盖率目标 ≥ 80%）。
7. 运行 `pnpm test && pnpm lint`。

注册完成后，`/tools/<id>`、侧边栏分组、首页卡片与 ⌘K 搜索会自动生效。

---

## 隐私与安全

- 客户端工具仅在浏览器内处理输入 —— 文本、办公文档、PDF 与图像皆然，不得将用户内容发送到远端。
- 收藏、最近使用与主题偏好保存在 `localStorage`（`syntools:*` 键），编辑器草稿同样只存本机。
- 生产环境安全响应头（CSP、COOP、Referrer-Policy 等）配置于 `vercel.json`。
- 后续服务端工具（`ToolMeta.mode = 'server'`）会在数据离开浏览器前明确标注。

---

## 性能预算

| 指标                     | 预算                                         |
| ------------------------ | -------------------------------------------- |
| 首屏入口资源（gzip）     | ≤ 185 KB                                     |
| 单个懒加载 chunk（gzip） | ≤ 500 KB（Univer / exceljs 等重依赖 ≤ 2 MB） |

由 `pnpm size`（`scripts/check-bundle-size.mjs`）强制校验。工具必须通过 `component: () => import(...)` 懒加载，避免进入首屏包；重量级第三方依赖应落在工具自己的异步 chunk 里（例如照片编辑器只在导出 PSD 时才载入 `ag-psd`）。图标优先使用内置 `Icon` 组件，勿引入大型图标库。

---

## 部署

构建产物为 `dist/` 下的静态 SPA。

**Vercel** — `vercel.json` 已配置 `buildCommand`、`outputDirectory`、SPA 重写与安全响应头（`BASE_PATH` 默认为 `/`）。

**其他托管** — 托管 `dist/`，将未知路径重写到 `index.html`，并对带 hash 的 `/assets/*` 做长缓存。若部署到 GitHub 项目站子路径，可用 `pnpm build:pages`（设置 `BASE_PATH=/syntools/`）。

```bash
pnpm build
pnpm preview   # 可选：本地预览
```

### 桌面应用（Tauri）

需已安装 [Rust](https://www.rust-lang.org/tools/install) 与各平台系统依赖（见 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)）。

```bash
pnpm tauri:dev     # 开发：Vite + 桌面窗口热更新
pnpm tauri:build   # 产物在 src-tauri/target/release/bundle/
```

CI 会在 **Linux / Windows / macOS** × **x64 / arm64**（共 6 个 runner）上执行 `pnpm tauri:build`，并上传各平台安装包产物。

---

## 参与贡献

1. Fork / clone 并创建功能分支。
2. 遵循工具模板与 TypeScript / ESLint / Prettier 规范。
3. 框架层勿引入工具专用第三方依赖（放到 `src/tools/*`）。
4. 提交 PR 前确保 `pnpm test`、`pnpm lint`、`pnpm typecheck` 通过。

---

<p align="center">
  <sub>为每一位需要快速、私密、本地工具的人而建 —— 从代码片段到办公文档与 PDF。</sub>
</p>
