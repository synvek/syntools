import { useTranslation } from 'react-i18next';
import { backgroundToColor } from '../core';
import { createDefaultTheme } from '../model/factory';
import { SLIDE_TEMPLATES } from '../model/templates';
import { useSlideStore } from '../store';
import { ActionRow, ColorInput, Field, Section, SelectInput, ToggleGroup } from './controls';

/** 主题面板里允许直接编辑的关键色（其余色板仍可点击套用为页面背景） */
const EDITABLE_KEYS = ['dk1', 'lt1', 'accent1', 'accent2', 'accent3', 'accent4'];
const FONT_CHOICES = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Tahoma',
  'PingFang SC',
  'Microsoft YaHei',
  'Noto Sans',
];

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
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const showPlaceholders = useSlideStore((s) => s.showPlaceholders);
  const togglePlaceholders = useSlideStore((s) => s.togglePlaceholders);
  const updateSlide = useSlideStore((s) => s.updateSlide);
  const applyTemplate = useSlideStore((s) => s.applyTemplate);
  const applyThemeColor = useSlideStore((s) => s.applyThemeColor);
  const setThemeFont = useSlideStore((s) => s.setThemeFont);
  const selection = useSlideStore((s) => s.selection);
  const promoteSelectedToMaster = useSlideStore((s) => s.promoteSelectedToMaster);
  const clearMasterElements = useSlideStore((s) => s.clearMasterElements);
  const setMasterBackground = useSlideStore((s) => s.setMasterBackground);
  const setViewMode = useSlideStore((s) => s.setViewMode);
  const master = doc.masters[0];

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
      {/* 本地模板库：纯数据、不联网，一键替换主题 + 母版 + 版式 */}
      <Section title={t('tools.slide.templateTitle')}>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.slide.templateHint')}
        </p>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {SLIDE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-label={t(`tools.slide.tpl${template.nameKey}`)}
              onClick={() => applyTemplate(template.id)}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-2 py-1.5 text-left text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                {['accent1', 'accent2', 'lt1', 'dk1'].map((key) => (
                  <span
                    key={key}
                    className="h-3.5 w-3.5 rounded-sm border border-black/10"
                    style={{ backgroundColor: template.theme.colors[key] ?? '#FFFFFF' }}
                  />
                ))}
              </span>
              <span className="truncate">{t(`tools.slide.tpl${template.nameKey}`)}</span>
              <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                {t(`tools.slide.tplCat${template.category}`)}
              </span>
            </button>
          ))}
        </div>
      </Section>

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
        {/* 直接编辑主题色本身（此前色板点击只能改页面背景，无法自定义主题） */}
        <Field label={t('tools.slide.themeColor')}>
          <div className="flex flex-wrap items-center gap-1">
            {EDITABLE_KEYS.map((key) => (
              <input
                key={key}
                type="color"
                aria-label={`${t('tools.slide.themeColor')} ${key}`}
                value={
                  /^#[0-9a-fA-F]{6}$/.test(doc.theme.colors[key] ?? '')
                    ? doc.theme.colors[key]
                    : '#000000'
                }
                onChange={(event) => applyThemeColor(key, event.target.value)}
                className="h-6 w-7 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
              />
            ))}
          </div>
        </Field>
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

      {/* 母版编辑：完整能力在「母版视图」（MasterView）里，这里只保留快捷入口与常用动作 */}
      <Section title={t('tools.slide.masterElements')}>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.slide.masterElements')}: {master?.elements.length ?? 0}
        </p>
        <ActionRow>
          <button
            type="button"
            onClick={() => setViewMode('master')}
            className="h-7 rounded-md bg-blue-600 px-2 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('tools.slide.viewMaster')}
          </button>
          <button
            type="button"
            disabled={selection.length === 0}
            onClick={promoteSelectedToMaster}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.promoteToMaster')}
          </button>
        </ActionRow>
        <Field label={t('tools.slide.masterBackground')}>
          <ColorInput
            ariaLabel={t('tools.slide.masterBackground')}
            value={backgroundToColor(master?.background, doc.theme.colors.lt1 ?? '#FFFFFF')}
            onChange={(color) => setMasterBackground(color)}
          />
        </Field>
        <ActionRow>
          <button
            type="button"
            disabled={(master?.elements.length ?? 0) === 0}
            onClick={clearMasterElements}
            className="h-7 rounded-md border border-red-300 px-2 text-[11px] text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            {t('tools.slide.clearMaster')}
          </button>
        </ActionRow>
      </Section>

      <Section title={t('tools.slide.layoutTitle')}>
        {doc.layouts.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.slide.noSelection')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {doc.layouts.map((layout, index) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => updateSlide({ layoutId: layout.id })}
                aria-label={layout.name ?? `${t('tools.slide.layoutTitle')} ${index + 1}`}
                className={`h-7 rounded-md border px-2 text-[11px] transition-colors ${
                  doc.slides[slideIndex]?.layoutId === layout.id
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                {layout.name ?? `${t('tools.slide.layoutTitle')} ${index + 1}`}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('tools.slide.panelPage')}>
        <Field label={t('tools.slide.majorFont')}>
          <SelectInput
            ariaLabel={t('tools.slide.majorFont')}
            value={doc.theme.majorFont.latin}
            options={FONT_CHOICES}
            onChange={(font) => setThemeFont('major', font)}
          />
        </Field>
        <Field label={t('tools.slide.minorFont')}>
          <SelectInput
            ariaLabel={t('tools.slide.minorFont')}
            value={doc.theme.minorFont.latin}
            options={FONT_CHOICES}
            onChange={(font) => setThemeFont('minor', font)}
          />
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
