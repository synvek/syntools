# 提示词数据维护指南

本目录是「AI 提示词库」工具的数据源，**与代码完全分离**：新增或修改提示词只需编辑这里的数据文件，无需改动任何 UI 代码。

## 文件结构

| 路径              | 作用                                                      |
| ----------------- | --------------------------------------------------------- |
| `categories.ts`   | 28 个分类清单（id / 展示顺序 / 多语言名称 / i18n 兜底键） |
| `prompts/<id>.ts` | 每个分类一个文件，导出该分类的提示词数组                  |
| `index.ts`        | 汇总全部数据为 `PROMPTS`，并在开发环境执行一致性校验      |
| `validate.ts`     | 校验规则实现（纯函数），供开发期断言与单元测试共用        |
| `../types.ts`     | 数据类型定义（`PromptItem` / `LocalizedText` 等）         |
| `../data.test.ts` | 数据完整性测试（条数、id 唯一性、中英文非空等）           |

## 数据格式

`prompts/writing.ts` 示例：

```ts
import type { PromptItem } from '../../types';

export const PROMPTS: PromptItem[] = [
  {
    id: 'writing-blog-outline',
    category: 'writing',
    title: { zh: '博客大纲', en: 'Blog outline' },
    prompt: {
      zh: '请围绕主题「{{topic}}」写一篇面向普通读者的博客大纲……',
      en: 'Create a blog outline on "{{topic}}" for general readers……',
    },
  },
];
```

字段说明：

| 字段       | 必填 | 说明                                                                     |
| ---------- | ---- | ------------------------------------------------------------------------ |
| `id`       | 是   | 全局唯一，kebab-case，且必须以 `category-` 开头，如 `coding-code-review` |
| `category` | 是   | 必须存在于 `categories.ts`                                               |
| `title`    | 是   | 多语言标题，`zh` / `en` 必填                                             |
| `prompt`   | 是   | 多语言正文，`zh` / `en` 必填；需要用户填写的信息用 `{{变量名}}` 占位     |

> `zh` 与 `en` 由 TypeScript 在编译期强制校验；缺失会在 `pnpm typecheck` 时报错。

## 新增一条提示词

1. 打开对应分类文件 `prompts/<category>.ts`，在数组末尾追加一项；
2. `id` 用 `<category>-<简短英文描述>`，确保全局不重复；
3. 同时补齐中英文标题与正文；
4. 运行校验：

   ```bash
   pnpm test && pnpm typecheck
   ```

## 新增一个分类

1. 在 `categories.ts` 的 `PROMPT_CATEGORIES` 中追加一项（`order` 取当前最大值 +1，`i18nKey` 固定为 `tools.aiPrompts.cat.<id>`）；
2. 新建 `prompts/<id>.ts`，导出 `PROMPTS: PromptItem[]`；
3. 在 `index.ts` 顶部新增 import（别名 `PROMPTS as XXX_PROMPTS`），并加入 `PROMPTS` 数组；
4. 建议每个分类至少维护 10 条。

## 新增一种语言

1. 在 `prompts/<category>.ts` 的 `title` / `prompt` 中按 Lang 键补充该语种（可选，缺失不影响编译）；
2. 在 `categories.ts` 中补充该语种的 `name`；
3. 语言码取值见 `@/core/i18n/types` 的 `Lang`（`zh` / `zh-TW` / `en` / `ja` / `fr` / `de` / `it` / `es` / `pt`）。

## 语言回退规则

**标题与正文**：精确匹配 → 基础语言（`zh-TW` → `zh`）→ `en` → 第一个非空值。

**分类名称**：数据中该语种 → i18n 既有译文 `tools.aiPrompts.cat.<id>` → 数据中基础语言 → 数据中 `en`。

> 目前 28 个分类中，`writing` / `coding` / `translate` / `marketing` / `learning` / `career` 六个历史分类在 9 个语种的 locale 文件中已有译名，会被自动复用；其余分类在其他语种下暂时显示英文，待补充 `name` 后自动生效。

## 校验规则

`validate.ts` 会检查以下内容，任一项不通过都会在开发环境抛出可读错误、并让 `../data.test.ts` 失败：

- 分类：`id` 合法且唯一、`order` 唯一、`i18nKey` 符合约定、中英文名称非空；
- 提示词：`id` 合法且全局唯一、`id` 以分类前缀开头、`category` 存在、中英文标题与正文非空；
- 内容底线（仅测试断言）：每个分类至少 10 条。

## 注意事项

- 医疗、法律、财务类提示词必须在正文中写明「仅供参考、不构成专业建议」；
- 请勿在本目录引入 React 或 UI 依赖，数据层保持纯粹，便于将来导出或用于翻译流水线；
- 不要手工修改 `src/core/i18n/locales/*.ts`：这些文件由 i18n 体系统一约束，本目录通过分类 `name` 与 i18n 兜底键协作，无需改动 locale。
