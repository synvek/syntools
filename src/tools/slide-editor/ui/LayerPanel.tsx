import { useTranslation } from 'react-i18next';
import type { SlideElement } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { Section } from './controls';

/**
 * Layer panel (equivalent to PowerPoint's "Selection Pane").
 *
 * Unlike photo-editor's LayerPanel, a slide's elements are **one flat array per slide**, so this stays
 * deliberately light: no drag-to-reorder and no group tree, only select / show-hide / lock / move up
 * and down, enough for the everyday "I can't find the element underneath" case.
 */

/**
 * Layer row title: prefer the element's own content (text, chart title, formula source),
 * and fall back to the element type's name used in the toolbar.
 */
function elementLabel(element: SlideElement, t: (key: string) => string): string {
  if (element.type === 'text' || element.type === 'shape') {
    const text = element.body?.paragraphs
      .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
      .join(' ')
      .trim();
    if (text) return text.length > 18 ? `${text.slice(0, 18)}…` : text;
  }
  if (element.type === 'image') return t('tools.slide.insertImage');
  if (element.type === 'table') return t('tools.slide.insertTable');
  if (element.type === 'group') return t('tools.slide.group');
  if (element.type === 'line') return t('tools.slide.insertLine');
  if (element.type === 'placeholder') return element.label;
  // Charts/formulas/icons used to fall into the "text box" fallback, inconsistent with the toolbar naming
  if (element.type === 'chart') {
    const title = element.title?.trim();
    return title || t('tools.slide.insertChart');
  }
  if (element.type === 'formula') {
    const latex = element.latex.trim();
    return latex
      ? `${t('tools.slide.insertFormula')}: ${latex.length > 14 ? `${latex.slice(0, 14)}…` : latex}`
      : t('tools.slide.insertFormula');
  }
  if (element.type === 'icon') return t('tools.slide.insertIcon');
  return t('tools.slide.insertText');
}

export function LayerPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  // In master view the layer list shows master/layout elements, so always read through the container
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const select = useSlideStore((s) => s.select);
  const patchElement = useSlideStore((s) => s.patchElement);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);

  const elements = containerElements({
    doc,
    viewMode,
    slideIndex,
    masterKind,
    masterIndex,
  });

  if (elements.length === 0) {
    return (
      <Section title={t('tools.slide.panelLayers')}>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('tools.slide.noLayers')}</p>
      </Section>
    );
  }

  return (
    <Section title={t('tools.slide.panelLayers')}>
      <ul className="flex flex-col gap-1">
        {/* Top layer first: matches the canvas's visual stacking */}
        {[...elements].reverse().map((element) => {
          const active = selection.includes(element.id);
          const hidden = element.visible === false;
          return (
            <li
              key={element.id}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${
                active
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <button
                type="button"
                onClick={() => select([element.id])}
                aria-label={`${t('tools.slide.panelLayers')}: ${elementLabel(element, t)}`}
                aria-pressed={active}
                className={`min-w-0 flex-1 truncate text-left text-[11px] ${
                  hidden
                    ? 'text-gray-400 line-through dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {elementLabel(element, t)}
              </button>
              <button
                type="button"
                aria-label={`${elementLabel(element, t)} ${hidden ? t('tools.slide.show') : t('tools.slide.hide')}`}
                aria-pressed={hidden}
                onClick={() => patchElement(element.id, { visible: hidden })}
                className="h-5 w-5 shrink-0 rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {hidden ? '🚫' : '👁'}
              </button>
              <button
                type="button"
                aria-label={`${elementLabel(element, t)} ${element.locked ? t('tools.slide.unlock') : t('tools.slide.lock')}`}
                aria-pressed={Boolean(element.locked)}
                onClick={() => patchElement(element.id, { locked: !element.locked })}
                className="h-5 w-5 shrink-0 rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {element.locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                aria-label={`${elementLabel(element, t)} ${t('tools.slide.bringForward')}`}
                onClick={() => {
                  select([element.id]);
                  bringForward();
                }}
                className="h-5 w-5 shrink-0 rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${elementLabel(element, t)} ${t('tools.slide.sendBackward')}`}
                onClick={() => {
                  select([element.id]);
                  sendBackward();
                }}
                className="h-5 w-5 shrink-0 rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                ↓
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
