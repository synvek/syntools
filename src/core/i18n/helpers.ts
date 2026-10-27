import { i18n } from '@/core/i18n';
import type { ToolMeta, ToolResult } from '@/core/types';
import { useTranslation } from 'react-i18next';

type ErrorResult = Extract<ToolResult<unknown>, { ok: false }>;

/** Translate a core error code into the active language */
export function translateToolError(prefix: string, result: ErrorResult): string {
  const key = `${prefix}.err.${result.error}`;
  if (i18n.exists(key)) {
    return i18n.t(key, result.params);
  }
  return result.error;
}

/** Localized display name and description for a tool's metadata */
export function getToolMeta(tool: ToolMeta) {
  return {
    name: i18n.t(`toolsMeta.${tool.id}.name`, { defaultValue: tool.name }),
    description: i18n.t(`toolsMeta.${tool.id}.description`, { defaultValue: tool.description }),
  };
}

/** React hook: localized display name and description for a tool's metadata */
export function useToolMeta(tool: ToolMeta) {
  const { t } = useTranslation();
  return {
    name: t(`toolsMeta.${tool.id}.name`, { defaultValue: tool.name }),
    description: t(`toolsMeta.${tool.id}.description`, { defaultValue: tool.description }),
  };
}
