import { useTranslation } from 'react-i18next';
import { backgroundToColor } from '../core';
import { useSlideStore } from '../store';
import { ColorInput, Field, Section } from './controls';
import { LayerPanel } from './LayerPanel';
import { PropertyPanel } from './PropertyPanel';
import { SlideCanvas } from './SlideCanvas';

/**
 * 独立母版视图。
 *
 * 与 PowerPoint 的「幻灯片母版」视图对应：左侧列出母版与全部版式，
 * 中间是可编辑画布，右侧是元素属性 / 图层面板。
 *
 * 视图只用一套 store：母版视图下所有元素操作都被 store 的
 * `containerElements` / `writeContainerElements` 路由到母版/版式元素，
 * 因此插入、对齐、组合、撤销等能力无需另写一份。
 */

const ROW_BASE =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors';

export function MasterView({ onRuntimeFailure }: { onRuntimeFailure: () => void }) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selectMasterTarget = useSlideStore((s) => s.selectMasterTarget);
  const setViewMode = useSlideStore((s) => s.setViewMode);
  const setContainerBackground = useSlideStore((s) => s.setContainerBackground);

  const currentBackground =
    masterKind === 'master'
      ? doc.masters[masterIndex]?.background
      : doc.layouts[masterIndex]?.background;

  return (
    <div className="flex h-[max(360px,calc(100vh-24rem))] gap-3">
      <aside className="flex w-[184px] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">
            {t('tools.slide.masterTargets')}
          </h3>
          <button
            type="button"
            onClick={() => setViewMode('normal')}
            className="h-6 rounded-md border border-gray-300 px-1.5 text-[11px] text-gray-500 transition-colors hover:bg-white dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.slide.exitMaster')}
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {doc.masters.map((master, index) => (
            <button
              key={master.id}
              type="button"
              onClick={() => selectMasterTarget('master', index)}
              className={`${ROW_BASE} ${
                masterKind === 'master' && masterIndex === index
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm border border-current opacity-60" />
              <span className="truncate">{master.name ?? t('tools.slide.masterName')}</span>
              <span className="ml-auto shrink-0 text-[10px] opacity-70">
                {master.elements.length}
              </span>
            </button>
          ))}
        </div>

        <h3 className="mt-1 text-[12px] font-semibold text-gray-600 dark:text-gray-300">
          {t('tools.slide.layouts')}
        </h3>
        <div className="flex flex-col gap-0.5">
          {doc.layouts.map((layout, index) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => selectMasterTarget('layout', index)}
              className={`${ROW_BASE} ${
                masterKind === 'layout' && masterIndex === index
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span className="h-3 w-4 shrink-0 rounded-sm border border-current opacity-60" />
              <span className="truncate">{layout.name ?? t('tools.slide.layoutName')}</span>
              <span className="ml-auto shrink-0 text-[10px] opacity-70">
                {layout.elements.length}
              </span>
            </button>
          ))}
        </div>

        <Section title={t('tools.slide.masterBackground')}>
          <Field label={t('tools.slide.background')}>
            <ColorInput
              ariaLabel={t('tools.slide.masterBackground')}
              value={backgroundToColor(currentBackground, '#FFFFFF')}
              onChange={(color) => setContainerBackground(color)}
            />
          </Field>
        </Section>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-200 px-3 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {t('tools.slide.masterBadge')}
          </span>
          <span className="truncate">
            {masterKind === 'master'
              ? (doc.masters[masterIndex]?.name ?? t('tools.slide.masterName'))
              : (doc.layouts[masterIndex]?.name ?? t('tools.slide.layoutName'))}
          </span>
          <span className="ml-auto">{t('tools.slide.masterHint')}</span>
        </div>
        <SlideCanvas onRuntimeFailure={onRuntimeFailure} />
      </main>

      <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/40">
        <PropertyPanel />
        <LayerPanel />
      </aside>
    </div>
  );
}
