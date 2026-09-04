import { i18n } from '@/core/i18n';
import type { ToolMeta, ToolResult } from '@/core/types';
import { useTranslation } from 'react-i18next';

type ErrorResult = Extract<ToolResult<unknown>, { ok: false }>;

/** 将 core 层错误码翻译为当前语言文案 */
export function translateToolError(prefix: string, result: ErrorResult): string {
  const key = `${prefix}.err.${result.error}`;
  if (i18n.exists(key)) {
    return i18n.t(key, result.params);
  }
  return result.error;
}

/** 获取工具元数据的当前语言展示名与描述 */
export function getToolMeta(tool: ToolMeta) {
  return {
    name: i18n.t(`toolsMeta.${tool.id}.name`, { defaultValue: tool.name }),
    description: i18n.t(`toolsMeta.${tool.id}.description`, { defaultValue: tool.description }),
  };
}

/** React Hook：工具元数据的当前语言展示名与描述 */
export function useToolMeta(tool: ToolMeta) {
  const { t } = useTranslation();
  return {
    name: t(`toolsMeta.${tool.id}.name`, { defaultValue: tool.name }),
    description: t(`toolsMeta.${tool.id}.description`, { defaultValue: tool.description }),
  };
}
