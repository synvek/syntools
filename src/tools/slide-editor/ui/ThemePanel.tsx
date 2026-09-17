import { useTranslation } from 'react-i18next';
import { createDefaultTheme } from '../model/factory';
import { useSlideStore } from '../store';
import { ActionRow, Field, Section, ToggleGroup } from './controls';

const SWATCH_KEYS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

/** 主题与母版面板：主题色板、字体方案、背景应用范围、占位符显示开关 */
export function ThemePanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const showPlaceholders = useSlideStore((s) => s.showPlaceholders);
  const togglePlaceholders = useSlideStore((s) => s.togglePlaceholders);
  const updateSlide = useSlideStore((s) => s.updateSlide);

  const applyBackground = (color: string, scope: 'current' | 'all') => {
    const state = useSlideStore.getState();
    state.commit();
    useSlideStore.setState((current) => ({
      doc: {
        ...current.doc,
        slides: current.doc.slides.map((slide, index) =>
          scope === 'all' || index === current.slideIndex ? { ...slide, background: color } : slide,
        ),
        version: current.doc.version + 1,
      },
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title={t('tools.slide.panelTheme')}>
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCH_KEYS.map((key) => {
            const color = doc.theme.colors[key] ?? '#000000';
            return (
              <button
                key={key}
                type="button"
                title={`${key} ${color}`}
                aria-label={`${key} ${color}`}
                onClick={() => applyBackground(color, 'current')}
                className="h-7 w-full rounded-md border border-gray-200 transition-transform hover:scale-105 dark:border-gray-700"
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
        <ActionRow>
          <button
            type="button"
            onClick={() => applyBackground(doc.theme.colors.lt1 ?? '#FFFFFF', 'all')}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.applyAll')}
          </button>
          <button
            type="button"
            onClick={() => applyBackground(doc.theme.colors.lt1 ?? '#FFFFFF', 'current')}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.applyCurrent')}
          </button>
        </ActionRow>
        <ActionRow>
          <button
            type="button"
            onClick={() => {
              const state = useSlideStore.getState();
              state.commit();
              useSlideStore.setState((current) => ({
                doc: {
                  ...current.doc,
                  theme: createDefaultTheme(),
                  version: current.doc.version + 1,
                },
              }));
            }}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.restoreTheme')}
          </button>
        </ActionRow>
      </Section>

      <Section title={t('tools.slide.panelPage')}>
        <Field label={t('tools.slide.fontFamily')}>
          <div className="text-right text-[11px] text-gray-500 dark:text-gray-400">
            <div>{doc.theme.majorFont.latin}</div>
            <div className="text-gray-400">{doc.theme.minorFont.latin}</div>
          </div>
        </Field>
        <Field label={t('tools.slide.showPlaceholders')}>
          <ToggleGroup
            ariaLabel={t('tools.slide.showPlaceholders')}
            value={showPlaceholders}
            onChange={() => togglePlaceholders()}
            options={[
              { value: true, label: t('tools.slide.showPlaceholders') },
              { value: false, label: t('tools.slide.fillNone') },
            ]}
          />
        </Field>
        <Field label={t('tools.slide.background')}>
          <button
            type="button"
            onClick={() => updateSlide({ background: undefined })}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.restoreTheme')}
          </button>
        </Field>
      </Section>
    </div>
  );
}
