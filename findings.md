# Findings

## 架构与约定（已核实）

- 注册表唯一入口：`src/core/registry/index.ts`（import 段 + `tools` 数组 + `toolMap`）。
- `CategoryId` 在 `src/core/types.ts` 第 7–18 行；`categories.ts` 的 `order` 决定侧边栏/首页顺序。
- Sidebar（`src/app/layout/Sidebar.tsx:148`）与 HomePage（`src/app/HomePage.tsx:115`）都用 `t(\`categories.${category.id}\`)`，且 `categories.map` 自动派生 → **新增分类只需改 types.ts + categories.ts + 9 个 locale**。
- `Category.name` 字段不参与展示。
- i18n 键前缀：
  - 工具名/描述 → `toolsMeta.<id>.name` / `.description`（`src/core/i18n/helpers.ts` `getToolMeta`）
  - 工具 UI → `tools.<id>.*`
  - 错误码 → `translateToolError('tools.<id>', result)` → `tools.<id>.err.<CODE>`
- locale 文件（9 个）三个注入锚点：`categories: {`、`toolsMeta: {`、`tools: {`。
- `src/core/i18n/resources.ts` 是遗留文件，全仓无引用，不改动。
- 首屏预算实测基线 180.04KB / 185KB，仅剩约 5KB 余量 → 收尾必须跑 `pnpm size`。
- 体积脚本 `scripts/check-bundle-size.mjs`：单 chunk ≤500KB，`vendor-univer-*` / `vendor-exceljs-*` ≤2MB。
- 工具 UI 通用组件：`IOTextArea`、`CopyButton`、`ActionButtons`（OptionBar/ClearButton/SwapButton/DownloadButton）、`ShareButton`、`FileDropZone`、`ToolPage`（外壳，自动挂标题/收藏/相关推荐）。
- 图标：`src/core/components/Icon.tsx` 内置 map，`ToolMeta.icon` 必须是已有 key；缺则在该文件补内联 SVG。

## 竞品差异

- it-tools / DevToys：编码与加解密深水区（Base32/58、RSA、bcrypt、ULID、chmod…），无文档编辑与深 PDF。
- iLovePDF：仅 PDF。
- 10015.io / 站长工具：长尾日常小工具（证件照、九宫格、房贷个税、OCR）。
- SynTools 差异优势：6 个文档级编辑器 + 19 个 PDF + 隐私本地。
