import { useTranslation } from 'react-i18next';
import { type TemplateKind } from '../core';

const TEMPLATES: TemplateKind[] = ['basic', 'decision', 'swimlane', 'bpmn'];

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: TemplateKind) => void;
}

export function TemplatePanel({ open, onClose, onSelect }: TemplatePanelProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.flowchart.templateTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('tools.flowchart.templateTitle')}
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
        <p className="mb-4 text-[12px] text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.templateHint')}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEMPLATES.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onSelect(kind);
                onClose();
              }}
              className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-500"
            >
              <div className="flex h-20 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <TemplateThumb kind={kind} />
              </div>
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.flowchart.template${kind[0].toUpperCase()}${kind.slice(1)}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateThumb({ kind }: { kind: TemplateKind }) {
  const c = { fill: '#EFF6FF', stroke: '#2563EB', strokeWidth: 1.5 };
  if (kind === 'decision') {
    return (
      <svg viewBox="0 0 80 50" className="h-16 w-full" aria-hidden="true">
        <ellipse cx={40} cy={12} rx={14} ry={7} {...c} />
        <polygon points="40,22 62,37 40,52 18,37" {...c} />
        <line x1={54} y1={16} x2={45} y2={30} stroke="#475569" strokeWidth={1} />
      </svg>
    );
  }
  if (kind === 'swimlane') {
    return (
      <svg viewBox="0 0 80 50" className="h-16 w-full" aria-hidden="true">
        <rect x={6} y={8} width={68} height={34} rx={4} {...c} />
        <rect x={6} y={8} width={68} height={10} rx={4} fill="#dbeafe" />
        <ellipse cx={24} cy={36} rx={9} ry={5} {...c} />
        <ellipse cx={52} cy={36} rx={9} ry={5} {...c} />
      </svg>
    );
  }
  if (kind === 'bpmn') {
    return (
      <svg viewBox="0 0 80 50" className="h-16 w-full" aria-hidden="true">
        <rect x={14} y={8} width={16} height={12} rx={6} {...c} />
        <rect x={44} y={8} width={22} height={12} rx={3} {...c} />
        <rect x={44} y={30} width={22} height={12} rx={3} {...c} />
        <line x1={30} y1={14} x2={44} y2={14} stroke="#475569" strokeWidth={1} />
        <line x1={55} y1={20} x2={55} y2={30} stroke="#475569" strokeWidth={1} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 50" className="h-16 w-full" aria-hidden="true">
      <ellipse cx={16} cy={14} rx={11} ry={6} {...c} />
      <rect x={32} y={8} width={16} height={12} rx={2} {...c} />
      <rect x={32} y={30} width={16} height={12} rx={2} {...c} />
      <ellipse cx={64} cy={36} rx={11} ry={6} {...c} />
      <line x1={27} y1={14} x2={32} y2={14} stroke="#475569" strokeWidth={1} />
      <line x1={48} y1={20} x2={48} y2={30} stroke="#475569" strokeWidth={1} />
      <line x1={48} y1={36} x2={53} y2={36} stroke="#475569" strokeWidth={1} />
    </svg>
  );
}
