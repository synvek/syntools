import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  buildTemplate,
  type TemplateCategory,
  type TemplateKind,
} from '../model/templates';
import { PageThumbnail } from '../model/PageThumbnail';
import type { FlowPage } from '../model/types';

/** 模板卡片缩略图：与「页面总览」同一套真实场景渲染（节点形状 + 连线） */
const PREVIEW_BOX = { width: 168, height: 56 };

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: TemplateKind) => void;
}

export function TemplatePanel({ open, onClose, onSelect }: TemplatePanelProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TemplateCategory>('flow');

  // 每个模板构建一次真实场景（仅几何，与语言无关）
  const previews = useMemo(() => {
    const map = new Map<TemplateKind, FlowPage>();
    for (const item of TEMPLATES) {
      const tpl = buildTemplate(item.kind);
      map.set(item.kind, {
        id: `preview-${item.kind}`,
        name: item.labelKey,
        nodes: tpl.nodes,
        edges: tpl.edges,
      });
    }
    return map;
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * 无鼠标场景的可用性：打开时把焦点移入弹窗，Tab 在弹窗内循环，
   * Esc 关闭。用捕获阶段监听，避免画布上的全局快捷键抢走按键。
   */
  useEffect(() => {
    if (!open) return;
    const container = dialogRef.current;
    if (!container) return;
    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

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
        ref={dialogRef}
        data-testid="flowchart-template-dialog"
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
            aria-label={t('tools.flowchart.closeDialog')}
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
              <div className="flex h-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white px-1 dark:border-gray-700 dark:bg-gray-900">
                {(() => {
                  const page = previews.get(item.kind);
                  return page ? (
                    <PageThumbnail page={page} box={PREVIEW_BOX} testId="template-thumb" />
                  ) : null;
                })()}
              </div>
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.flowchart.template${item.labelKey}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
