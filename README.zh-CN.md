# SynTools

[English](./README.md) | **简体中文**

**面向开发者的隐私优先、浏览器本地工具集。**

SynTools 把日常常用的工具收拢到同一入口：编解码、格式化、哈希、图片/PDF 处理、生成器等，全部在浏览器中运行。无需安装、无需账号，默认情况下**数据不会离开本机**。

---

## 为什么选择 SynTools？

| 痛点 | SynTools 如何解决 |
| --- | --- |
| 工具散落在多个广告密集的网站 | 统一界面与单一搜索入口 |
| 敏感文本需上传到第三方服务器 | 默认纯前端本地计算 |
| 常用工具反复搜索、收藏困难 | 收藏、最近使用与 ⌘K 搜索 |

**核心价值**

1. **隐私** — 除非工具明确需要服务端，处理均在浏览器内完成
2. **快速** — 静态站点 + 本地计算，输入即出结果
3. **一致** — 统一布局、输入输出面板、复制/下载与错误处理
4. **可扩展** — 注册表驱动的插件机制；新增工具只需一个目录 + 一行注册

---

## 功能特性

- **90+ 工具**：覆盖编码、文本、格式化、加密哈希、时间日期、生成器、网络、图片、PDF 等
- **全局搜索**：`⌘/Ctrl + K`，或在非输入状态下按 `/`
- **最近使用与收藏**：保存在本机 `localStorage`
- **亮色 / 暗色主题**：默认跟随系统，刷新无闪烁
- **国际化就绪**：已具备中英文文案
- **工具懒加载**：应用外壳保持轻量，各工具按需加载
- **静态部署**：支持 Vercel、Cloudflare Pages 等任意静态托管

---

## 工具分类

| 分类 | 示例 |
| --- | --- |
| 编码转换 | Base64、URL 编解码、Unicode、HTML 实体、ASCII 表 |
| 文本处理 | 正则测试、文本对比、大小写转换、字数统计、拼音、简繁转换 |
| 格式化 | JSON / SQL / HTML / JS / CSS / XML 格式化、Markdown 预览 |
| 加密哈希 | 哈希计算、JWT 解析、密码生成 |
| 时间日期 | 时间戳、日历、倒计时、秒表、Cron 解析/生成 |
| 生成器 | UUID、二维码、随机字符串/数字、占位图、CSS 渐变 |
| 图片处理 | 压缩、裁剪、合并、水印、GIF 帧、SVG→PNG、Base64、ICO |
| PDF 工具 | 合并、拆分、旋转、加密、批注、图文互转、页码、签名 |
| 网络 | UA 解析 |
| 其他 | 计算器、MBTI、AI 提示词、Mermaid、思维导图、图表生成 … |

完整列表见首页，或查看 `src/core/registry/index.ts`。

---

## 技术栈

| 层级 | 选型 |
| --- | --- |
| 语言 | TypeScript（strict） |
| UI | React 18 |
| 构建 | Vite 6 |
| 路由 | React Router 7 |
| 样式 | Tailwind CSS 3（`darkMode: 'class'`） |
| 状态 | Zustand |
| 国际化 | i18next / react-i18next |
| 单元测试 | Vitest + Testing Library |
| E2E | Playwright |
| 包管理 | pnpm 11 |

架构为**注册表驱动（Registry-Driven）**：侧边栏、首页卡片、搜索索引与路由均由 `src/core/registry/index.ts` 中的单一 `tools` 数组派生。

---

## 环境要求

| 依赖 | 版本 |
| --- | --- |
| Node.js | ≥ 20（推荐 22.x） |
| pnpm | 11.x（由 `packageManager` 锁定） |

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

打开 [http://localhost:5173](http://localhost:5173)。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 类型检查（`tsc -b`）+ 生产构建 |
| `pnpm preview` | 本地预览生产构建产物 |
| `pnpm test` | 运行单元测试（Vitest） |
| `pnpm test:watch` | Vitest 监听模式 |
| `pnpm e2e` | 运行 Playwright 端到端测试 |
| `pnpm lint` | ESLint 检查（零警告策略） |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm format` | Prettier 格式化写入 |
| `pnpm format:check` | Prettier 检查 |
| `pnpm typecheck` | 仅 TypeScript 类型检查 |
| `pnpm size` | 包体积预算检查 |

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

- 客户端工具仅在浏览器内处理输入，不得将用户内容发送到远端。
- 收藏、最近使用与主题偏好保存在 `localStorage`（`syntools:*` 键）。
- 生产环境安全响应头（CSP、COOP、Referrer-Policy 等）配置于 `vercel.json`。
- 后续服务端工具（`ToolMeta.mode = 'server'`）会在数据离开浏览器前明确标注。

---

## 性能预算

| 指标 | 预算 |
| --- | --- |
| 应用外壳（gzip） | ≤ 150 KB |
| 单工具 chunk（gzip） | ≤ 100 KB（尽量更小） |

工具必须通过 `component: () => import(...)` 懒加载，避免进入首屏包。图标优先使用内置 `Icon` 组件，勿引入大型图标库。

---

## 部署

构建产物为 `dist/` 下的静态 SPA。

**Vercel** — `vercel.json` 已配置 `buildCommand`、`outputDirectory`、SPA 重写与安全响应头。

**其他托管** — 托管 `dist/`，将未知路径重写到 `index.html`，并对带 hash 的 `/assets/*` 做长缓存。

```bash
pnpm build
pnpm preview   # 可选：本地预览
```

---

## 参与贡献

1. Fork / clone 并创建功能分支。
2. 遵循工具模板与 TypeScript / ESLint / Prettier 规范。
3. 框架层勿引入工具专用第三方依赖（放到 `src/tools/*`）。
4. 提交 PR 前确保 `pnpm test`、`pnpm lint`、`pnpm typecheck` 通过。

---

<p align="center">
  <sub>为需要快速、私密、本地工具的开发者而建。</sub>
</p>
