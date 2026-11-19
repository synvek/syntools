# PDF 编辑器

本地运行的 PDF 标注与编辑工具（`/tools/pdf-editor`）。文件不离开浏览器：打开、渲染、保存全部在前端完成，草稿存在 IndexedDB。

## 能力

| 模块 | 内容                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| 打开 | 拖入/选择 PDF；单文件上限 50 MB；加密文件就地输入密码；刷新后可从草稿恢复                   |
| 阅读 | 单页/连续滚动、缩放（自定义 / 适合宽度 / 适合页面）、缩略图、大纲、深色画布                 |
| 对象 | 文本、图片、画笔、标记（高亮/下划线/删除线）、形状（矩形/椭圆/箭头/直线）、便签、图章、签名 |
| 编辑 | 多选、八向缩放、旋转（15° 吸附）、层级、锁定、透明度、复制/剪切/粘贴、Delete、方向键微调    |
| 页面 | 删除、拖拽重排、左右旋转、插入空白页、从文件插入页、复制、提取单页、按页导出 ZIP            |
| 文本 | 点选原文本行 → 遮盖并重写（`patch`）；导出 Word 时可重建标题/段落/列表                      |
| 图片 | 插入（文件 / 拖入 / ⌘V）、替换、九宫格裁剪、contain/cover/fill                              |
| 签名 | 手写签名板（2× DPR 导出）、上传图片签名；四个预设图章（已批准/已阅/作废/草稿）              |
| 导出 | PDF（扁平化保存）、Word（文本 / 图片 / 混合三模式）、PNG/JPEG（96/150/300 DPI）、纯文本     |
| 面板 | 缩略图、大纲、属性、注释列表；开关状态写入 `localStorage`                                   |

## 关键约束

- **保存即扁平化**：所有对象由 pdf-lib 重新绘制进页面内容流，不写 `/Annots`。因此保存后的注释在任何阅读器里都可见，但不可再编辑。
- **文本修补是覆盖**：白/米色矩形盖住原字形，再写新文本；不会重排整页，原文仍在内容流里，Word 的“文本模式”导出会带上原文字。
- **Word 三模式**：`text` 可编辑但丢批注与遮盖；`raster` 逐页 150 DPI 位图、像素保真但不可编辑；`mixed` 有文本层走文本、扫描页走图片（推荐）。
- **大文件降级**：超过 20 MB 时缩略图改为手动生成、关闭相邻页预热；页画布使用 8 张上限的 LRU。
- **加密 PDF 不能被“从文件插入页”**：编辑器只保留一个密码输入口。
- 导出与保存前都会重新 `flattenPdf`，不会把上一次导出的字节当成源。

## 代码结构

```
src/tools/pdf-editor/
  PdfEditorTool.tsx        控制器：状态、命令、Ribbon 装配
  ribbonTabs.ts            home / annotate / edit / view + 3 个上下文标签
  model/                   doc（页面/reducer）、objects（工厂/对齐/格式）、history、annotate
  render/                  usePdfDocument、PageScrollView、PageCanvas、TextPatchLayer、canvasCache
  overlay/                 OverlayLayer（选择/拖动/手势）、objectViews、hitTest、handles、tools/*
  io/                      savePdf（flatten）、drawObject、pageImport/pageExport、imageImport/imageCrop、
                           pdfStructure、exportDocx/exportImages/exportText、draftStore
  ui/                      对话框、面板、签名板、图章、状态栏
src/core/pdf/              textLines（行聚类）、render（pdfjs）、load、download、types
src/core/docx/             窄 Word 构建器（HTML → docx，动态加载 `docx`）
```

文本行聚类放在 `src/core/pdf`，因为编辑器的修补层与 Word 导出共用同一份实现。

## 快捷键

| 按键                           | 行为                                      |
| ------------------------------ | ----------------------------------------- |
| ⌘/Ctrl + S                     | 保存并下载（表单内也生效）                |
| ⌘/Ctrl + Z / ⇧⌘Z / Ctrl+Y      | 撤销 / 重做                               |
| ⌘/Ctrl + A                     | 全选对象                                  |
| ⌘/Ctrl + C / X / V             | 复制 / 剪切 / 粘贴（⌘V 也接受剪贴板图片） |
| Delete / Backspace             | 删除选中（跳过锁定对象）                  |
| 方向键（+Shift）               | 按页宽 0.1% / 1% 微调                     |
| PageUp / PageDown / Home / End | 翻页 / 首页 / 末页                        |
| Esc                            | 退出当前工具、清空选择                    |

## 测试与门禁

- 单测：`vitest run src/tools/pdf-editor src/core/docx src/core/pdf`（45 文件 / 431 例）
- 端到端：`playwright test e2e/pdf-editor.spec.ts`（18 例：打开/翻页/草稿/密码/高亮/图片/矩形+画笔/文本修补/签名/删页保存/旋转+CropBox/Word/PNG）
- 无障碍：`e2e/a11y-p04.spec.ts` 的 PDF 场景（功能区 axe，critical/serious 为 0）
- 体积：`pnpm build && pnpm size`（entry 实测 193.32 KB，预算 195 KB）
- 许可：`pnpm license:check`；`@cantoo/pdf-lib` 已列入 `THIRD-PARTY-NOTICES.md`

## 已知限制

- 没有 OCR：扫描件只能按图片导出/保存，不能修补文本。
- 文本修补按行覆盖，不做行内局部重排；字体回退到 pdf-lib 的标准字体，特殊字形可能变化。
- 不支持 AcroForm 表单填写、PDF/A、加密保存、多文档库（P1）。
- 三端（Acrobat / Chrome / 预览）人工核验需按计划 §11.5 执行，仓库内只有自动化用例；`fixtures/pdf/rotated-cropbox.pdf` 是旋转 + 非零 CropBox 的回归样本。
