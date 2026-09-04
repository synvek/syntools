import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_CARD_STYLE,
  DEFAULT_MARKDOWN,
  MAX_FONT_SIZE,
  MAX_LINE_HEIGHT,
  MAX_PADDING,
  MAX_WIDTH,
  MD_FONTS,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
  MIN_PADDING,
  MIN_WIDTH,
  isMdFontId,
  normalizeHexColor,
  prepareMarkdownHtml,
  resolveCardStyle,
  toCardCss,
  type MdFontId,
} from './core';

/** Markdown 转图片：编辑 → 预览 → 导出 PNG */
export default function MdToImageTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        i: DEFAULT_MARKDOWN,
        g: 1,
        b: 0,
        p: DEFAULT_CARD_STYLE.padding,
        bg: DEFAULT_CARD_STYLE.background,
        fg: DEFAULT_CARD_STYLE.color,
        ft: DEFAULT_CARD_STYLE.font,
        fs: DEFAULT_CARD_STYLE.fontSize,
        w: DEFAULT_CARD_STYLE.width,
        lh: DEFAULT_CARD_STYLE.lineHeight,
      }),
    [],
  );
  const [input, setInput] = useState(String(init.i || DEFAULT_MARKDOWN));
  const [gfm, setGfm] = useState(Number(init.g) !== 0);
  const [breaks, setBreaks] = useState(Number(init.b) === 1);
  const [padding, setPadding] = useState(Number(init.p) || DEFAULT_CARD_STYLE.padding);
  const [bg, setBg] = useState(
    () => normalizeHexColor(String(init.bg)) ?? DEFAULT_CARD_STYLE.background,
  );
  const [fg, setFg] = useState(
    () => normalizeHexColor(String(init.fg)) ?? DEFAULT_CARD_STYLE.color,
  );
  const [font, setFont] = useState<MdFontId>(
    isMdFontId(String(init.ft)) ? (init.ft as MdFontId) : DEFAULT_CARD_STYLE.font,
  );
  const [fontSize, setFontSize] = useState(Number(init.fs) || DEFAULT_CARD_STYLE.fontSize);
  const [width, setWidth] = useState(Number(init.w) || DEFAULT_CARD_STYLE.width);
  const [lineHeight, setLineHeight] = useState(Number(init.lh) || DEFAULT_CARD_STYLE.lineHeight);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => prepareMarkdownHtml(input, { gfm, breaks }),
    [input, gfm, breaks],
  );
  const html = result.ok ? result.value : '';

  const styleResult = useMemo(
    () =>
      resolveCardStyle({
        background: bg,
        color: fg,
        font,
        fontSize,
        width,
        padding,
        lineHeight,
      }),
    [bg, fg, font, fontSize, width, padding, lineHeight],
  );
  const cardCss = styleResult.ok ? toCardCss(styleResult.value) : toCardCss(DEFAULT_CARD_STYLE);

  const download = async () => {
    const node = cardRef.current;
    if (!node || !result.ok || !styleResult.ok) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: styleResult.value.background,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `markdown-${Date.now()}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={gfm}
            onChange={(e) => setGfm(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.mdToImage.gfm')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={breaks}
            onChange={(e) => setBreaks(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.mdToImage.breaks')}
        </label>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
        <ShareButton
          getState={() => ({
            i: input.slice(0, 1600),
            g: gfm ? 1 : 0,
            b: breaks ? 1 : 0,
            p: padding,
            bg,
            fg,
            ft: font,
            fs: fontSize,
            w: width,
            lh: lineHeight,
          })}
        />
        <button
          type="button"
          onClick={download}
          disabled={!result.ok || !styleResult.ok || exporting}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.mdToImage.exporting') : t('tools.mdToImage.download')}
        </button>
      </OptionBar>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.font')}
          <select
            value={font}
            onChange={(e) => setFont(e.target.value as MdFontId)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {MD_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(`tools.mdToImage.fonts.${f.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.fontSize')}
          <input
            type="number"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.width')}
          <input
            type="number"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.padding')}
          <input
            type="number"
            min={MIN_PADDING}
            max={MAX_PADDING}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.lineHeight')}
          <input
            type="number"
            min={MIN_LINE_HEIGHT}
            max={MAX_LINE_HEIGHT}
            step={0.1}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.fg')}
          <input
            type="color"
            value={normalizeHexColor(fg) ?? DEFAULT_CARD_STYLE.color}
            onChange={(e) => setFg(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
          <input
            type="text"
            value={fg}
            onChange={(e) => setFg(e.target.value)}
            spellCheck={false}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mdToImage.bg')}
          <input
            type="color"
            value={normalizeHexColor(bg) ?? DEFAULT_CARD_STYLE.background}
            onChange={(e) => setBg(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
          <input
            type="text"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            spellCheck={false}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      {!styleResult.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.mdToImage.err.${styleResult.error}`)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <IOTextArea
          label={t('tools.mdToImage.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.mdToImage.placeholder')}
          rows={18}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.mdToImage.preview')}
          </span>
          {input.trim() && !result.ok ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.mdToImage.err.${result.error}`)}
            </p>
          ) : (
            <div className="max-h-[36rem] overflow-auto rounded-md border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div
                ref={cardRef}
                className="md-to-image-card shadow-sm"
                style={cardCss}
                dangerouslySetInnerHTML={{ __html: html || '<p></p>' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
