import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { writeHandoff } from '@/core/lib/handoff';
import { toolMap } from '@/core/registry';
import { getToolMeta } from '@/core/i18n/helpers';

/** 将当前输出带到另一工具（轻量串联） */
export function OpenInToolButton({
  targetId,
  text,
  disabled,
}: {
  targetId: string;
  text: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const target = toolMap.get(targetId);
  if (!target) return null;
  const { name } = getToolMeta(target);

  return (
    <button
      type="button"
      disabled={disabled || !text}
      onClick={() => {
        if (!writeHandoff({ targetId, text })) return;
        navigate(`/tools/${targetId}`);
      }}
      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
    >
      {t('tool.openIn', { name })}
    </button>
  );
}
