import { useTranslation } from 'react-i18next';
import type { SlideElement } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { Section } from './controls';

/**
 * 图层面板（等价于 PowerPoint 的「选择窗格」）。
 *
 * 与 photo-editor 的 LayerPanel 不同，幻灯片的元素是**每页一个扁平数组**，
 * 因此这里刻意保持轻量：不做拖拽排序与编组树，只提供
 * 选中 / 显隐 / 锁定 / 上移下移，够覆盖日常「找不到被压住的元素」的场景。
 */

/**
 * 图层行标题：优先展示元素自带的内容（文字、图表标题、公式源码），
 * 其次退回该元素类型在工具栏里的名称。
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
  // 图表/公式/图标此前会落到「文本框」这个兜底分支，与工具栏的命名口径不一致
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
  // 母版视图下图层列表展示的是母版/版式元素，因此统一走容器读取
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
        {/* 顶层在上：与画布的视觉层序一致 */}
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
