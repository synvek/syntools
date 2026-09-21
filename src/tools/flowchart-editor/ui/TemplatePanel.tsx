import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  buildTemplate,
  type TemplateCategory,
  type TemplateKind,
} from '../model/templates';
import { shapeDefOf } from '../model/shapes';
import { drawShape } from '../nodes/shapeDraw';
import type { ShapeKind } from '../model/types';

/** 缩略图：直接用模板首个节点的形状绘制，与画布效果一致 */
function TemplateThumb({ kind }: { kind: ShapeKind }) {
  const def = shapeDefOf(kind);
  if (!def) return null;
  const w = def.size.width;
  const h = def.size.height;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-12 w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="#EFF6FF" stroke="#2563EB" strokeWidth={Math.max(2, w / 38)}>
        {drawShape(def, w, h)}
      </g>
    </svg>
  );
}

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: TemplateKind) => void;
}

export function TemplatePanel({ open, onClose, onSelect }: TemplatePanelProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TemplateCategory>('flow');

  // 每个模板取首个节点的形状作为缩略图（仅计算一次）
  const previews = useMemo(() => {
    const map = new Map<TemplateKind, ShapeKind>();
    for (const item of TEMPLATES) {
      const tpl = buildTemplate(item.kind);
      map.set(item.kind, tpl.nodes[0]?.data.kind ?? 'rect');
    }
    return map;
  }, []);

  if (!open) return null;
  const items = TEMPLATES.filter((item) => item.category === category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.flowchart.templateTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
        <p className="mb-3 text-[12px] text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.templateHint')}
        </p>

        <div className="mb-4 flex flex-wrap gap-1">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                category === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-500/10'
              }`}
            >
              {t(`tools.flowchart.cat_${c}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => {
                onSelect(item.kind);
                onClose();
              }}
              className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-500"
            >
              <div className="flex h-16 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-gray-900">
                <TemplateThumb kind={previews.get(item.kind) ?? 'rect'} />
              </div>
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.flowchart.template${item.kind[0].toUpperCase()}${item.kind.slice(1)}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
