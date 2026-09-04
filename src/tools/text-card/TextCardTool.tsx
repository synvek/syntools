import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  CARD_THEMES,
  DEFAULT_TEXT_CARD,
  THEME_STYLES,
  clampTextCard,
  hasCardContent,
  type CardThemeId,
  type TextAlign,
  type TextCardOptions,
} from './core';

/** 文字转卡片制作 */
export default function TextCardTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        title: '',
        body: '把想法写成一张好看的卡片',
        th: DEFAULT_TEXT_CARD.theme,
        al: DEFAULT_TEXT_CARD.align,
        fs: DEFAULT_TEXT_CARD.fontSize,
        p: DEFAULT_TEXT_CARD.padding,
        r: DEFAULT_TEXT_CARD.radius,
        w: DEFAULT_TEXT_CARD.width,
      }),
    [],
  );
  const [title, setTitle] = useState(String(init.title || ''));
  const [body, setBody] = useState(String(init.body || ''));
  const [options, setOptions] = useState<TextCardOptions>(() =>
    clampTextCard({
      theme: init.th as CardThemeId,
      align: init.al as TextAlign,
      fontSize: Number(init.fs),
      padding: Number(init.p),
      radius: Number(init.r),
      width: Number(init.w),
    }),
  );
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const patch = (partial: Partial<TextCardOptions>) =>
    setOptions((prev) => clampTextCard({ ...prev, ...partial }));

  const style = THEME_STYLES[options.theme];
  const canExport = hasCardContent(title, body);

  const download = async () => {
    const node = cardRef.current;
    if (!node || !canExport) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `text-card-${Date.now()}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.textCard.theme')}
          <select
            value={options.theme}
            onChange={(e) => patch({ theme: e.target.value as CardThemeId })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CARD_THEMES.map((id) => (
              <option key={id} value={id}>
                {t(`tools.textCard.themes.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.textCard.align')}
          <select
            value={options.align}
            onChange={(e) => patch({ align: e.target.value as TextAlign })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="left">{t('tools.textCard.aligns.left')}</option>
            <option value="center">{t('tools.textCard.aligns.center')}</option>
            <option value="right">{t('tools.textCard.aligns.right')}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void download()}
          disabled={exporting || !canExport}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.textCard.exporting') : t('tools.textCard.download')}
        </button>
        <ShareButton
          getState={() => ({
            title,
            body,
            th: options.theme,
            al: options.align,
            fs: options.fontSize,
            p: options.padding,
            r: options.radius,
            w: options.width,
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.textCard.fontSize')}
          <input
            type="range"
            min={12}
            max={48}
            value={options.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.fontSize}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.textCard.padding')}
          <input
            type="range"
            min={16}
            max={72}
            value={options.padding}
            onChange={(e) => patch({ padding: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.padding}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.textCard.width')}
          <input
            type="range"
            min={280}
            max={900}
            step={20}
            value={options.width}
            onChange={(e) => patch({ width: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{options.width}</span>
        </label>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.textCard.title')}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tools.textCard.titlePlaceholder')}
              maxLength={80}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <IOTextArea
            label={t('tools.textCard.body')}
            value={body}
            onChange={setBody}
            placeholder={t('tools.textCard.bodyPlaceholder')}
            actions={<ClearButton onClick={() => setBody('')} disabled={!body} />}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.textCard.preview')}
          </span>
          <div className="overflow-auto rounded-md border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-950">
            <div
              ref={cardRef}
              className="mx-auto shadow-xl"
              style={{
                width: options.width,
                maxWidth: '100%',
                padding: options.padding,
                borderRadius: options.radius,
                background: style.background,
                color: style.color,
                border: `1px solid ${style.border}`,
                textAlign: options.align,
                boxSizing: 'border-box',
              }}
            >
              {title.trim() && (
                <h2
                  style={{
                    margin: 0,
                    marginBottom: body.trim() ? 12 : 0,
                    fontSize: Math.round(options.fontSize * 1.35),
                    fontWeight: 700,
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}
                >
                  {title}
                </h2>
              )}
              {body.trim() && (
                <p
                  style={{
                    margin: 0,
                    fontSize: options.fontSize,
                    lineHeight: 1.6,
                    color: title.trim() ? style.muted : style.color,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {body}
                </p>
              )}
              {!canExport && (
                <p style={{ margin: 0, color: style.muted, fontSize: 14 }}>
                  {t('tools.textCard.empty')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
