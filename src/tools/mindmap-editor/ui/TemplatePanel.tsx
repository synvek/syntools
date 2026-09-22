import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildMindTemplate, MIND_TEMPLATES, type MindTemplateKind } from '../model/templates';
import { themeOf } from '../model/themes';

/** 缩略图：与画布同款的「中心 + 三分支」结构 */
function Preview({ themeId }: { themeId: string }) {
  const theme = themeOf(themeId);
  const branches = [12, 32, 52];
  return (
    <svg viewBox="0 0 120 64" className="h-full w-full" aria-hidden="true">
      {branches.map((y, i) => (
        <path
          key={y}
          d={`M46 32 C 56 32, 56 ${y + 6}, 68 ${y + 6}`}
          fill="none"
          stroke={theme.branches[i % theme.branches.length]}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <rect x={6} y={22} width={40} height={20} rx={10} fill={theme.root.fill} />
      {branches.map((y, i) => (
        <rect
          key={y}
          x={68}
          y={y}
          width={40}
          height={12}
          rx={6}
          fill="#ffffff"
          stroke={theme.branches[i % theme.branches.length]}
          strokeWidth={1.6}
        />
      ))}
    </svg>
  );
}

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: MindTemplateKind) => void;
}

export function TemplatePanel({ open, onClose, onSelect }: TemplatePanelProps) {
  const { t } = useTranslation();
  const previews = useMemo(
    () => new Map(MIND_TEMPLATES.map((kind) => [kind, buildMindTemplate(kind).themeId])),
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.mindmap.templateTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('tools.mindmap.templateTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-[12px] text-gray-500 dark:text-gray-400">
          {t('tools.mindmap.templateHint')}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MIND_TEMPLATES.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onSelect(kind);
                onClose();
              }}
              className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-500"
            >
              <div className="flex h-16 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-gray-900">
                <Preview themeId={previews.get(kind) ?? 'classic'} />
              </div>
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.mindmap.template${kind[0].toUpperCase()}${kind.slice(1)}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
