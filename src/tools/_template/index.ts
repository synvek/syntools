import type { ToolMeta } from '@/core/types';

/**
 * Tool metadata template - copy this directory, then follow these steps:
 * 1. Rename the directory to the tool id (lowercase kebab-case, e.g. `jwt-parser`);
 * 2. Update id / name / description / category / keywords / icon below;
 * 3. Rename TemplateTool.tsx to match the tool and update the component import;
 * 4. Register this metadata in the `tools` array of `src/core/registry/index.ts` (one line);
 * 5. Fill in the `core.ts` pure functions and `core.test.ts` cases (coverage >= 80%);
 * 6. Run `pnpm test && pnpm lint` to confirm it passes.
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
