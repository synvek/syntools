import type { ToolMeta } from '@/core/types';

/**
 * 工具元数据模板 —— 复制本目录后按以下步骤修改：
 * 1. 目录重命名为工具 id（小写短横线，如 `jwt-parser`）；
 * 2. 修改下方 id / name / description / category / keywords / icon；
 * 3. 将 TemplateTool.tsx 重命名为与工具匹配的文件名并同步 component 导入；
 * 4. 在 `src/core/registry/index.ts` 的 `tools` 数组中注册本元数据（1 行）；
 * 5. 补齐 `core.ts` 纯函数与 `core.test.ts` 用例（覆盖率 ≥ 80%）；
 * 6. 运行 `pnpm test && pnpm lint` 确认通过。
 */
export const templateTool: ToolMeta = {
  id: 'template',
  name: '工具模板',
  description: '复制本目录并修改元数据即可接入一个新工具',
  category: 'other',
  keywords: ['template', '模板', '示例'],
  icon: 'text',
  component: () => import('./TemplateTool'),
  weight: 99,
};
