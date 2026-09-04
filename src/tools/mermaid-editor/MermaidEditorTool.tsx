import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_MERMAID,
  DEFAULT_THEME_ID,
  MAX_ZOOM,
  MERMAID_THEMES,
  MIN_ZOOM,
  ZOOM_STEP,
  buildMermaidInitConfig,
  clampZoom,
  getMermaidTheme,
  injectSvgBackground,
  isMermaidThemeId,
  parseSvgSize,
  validateMermaidSource,
  type MermaidThemeId,
} from './core';

async function svgStringToPngDataUrl(svg: string, scale = 2): Promise<string> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('svg-load'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    const w = Math.max(1, img.naturalWidth || img.width);
    const h = Math.max(1, img.naturalHeight || img.height);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mermaid 在线绘图（本地 import mermaid） */
export default function MermaidEditorTool() {
  const { t } = useTranslation();
  const reactId = useId().replace(/:/g, '');
  const init = useMemo(
    () => readSharedState({ i: DEFAULT_MERMAID, th: DEFAULT_THEME_ID, z: 1 }),
    [],
  );
  const [input, setInput] = useState(String(init.i || DEFAULT_MERMAID));
  const [themeId, setThemeId] = useState<MermaidThemeId>(
    isMermaidThemeId(String(init.th)) ? (init.th as MermaidThemeId) : DEFAULT_THEME_ID,
  );
  const [zoom, setZoom] = useState(() => clampZoom(Number(init.z) || 1));
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const validated = useMemo(() => validateMermaidSource(input), [input]);
  const theme = getMermaidTheme(themeId);
  const size = useMemo(() => (svg ? parseSvgSize(svg) : { width: 0, height: 0 }), [svg]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!validated.ok) {
        setSvg('');
        setRenderError(null);
        return;
      }
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize(buildMermaidInitConfig(theme));
        const id = `mmd-${reactId}-${Date.now()}`;
        const { svg: out } = await mermaid.render(id, validated.value);
        if (!cancelled) {
          setSvg(out);
          setRenderError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg('');
          setRenderError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [validated, reactId, theme]);

  const exportSvg = useMemo(
    () => (svg ? injectSvgBackground(svg, theme.background) : ''),
    [svg, theme.background],
  );

  const downloadSvg = () => {
    if (!exportSvg) return;
    const blob = new Blob([exportSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mermaid.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!exportSvg) return;
    setExporting(true);
    try {
      const dataUrl = await svgStringToPngDataUrl(exportSvg, 2);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'mermaid.png';
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const zoomBy = (delta: number) => setZoom((z) => clampZoom(z + delta));

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.mermaid.theme')}
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value as MermaidThemeId)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {MERMAID_THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {t(`tools.mermaid.themes.${th.id}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            aria-label={t('tools.mermaid.zoomOut')}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-[4.5rem] rounded-md border border-gray-300 px-2 py-1 font-mono text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t('tools.mermaid.zoomReset')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            aria-label={t('tools.mermaid.zoomIn')}
          >
            +
          </button>
        </div>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
        <ShareButton
          getState={() => ({
            i: input.slice(0, 1600),
            th: themeId,
            z: zoom,
          })}
        />
        <button
          type="button"
          onClick={downloadSvg}
          disabled={!exportSvg}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('tools.mermaid.downloadSvg')}
        </button>
        <button
          type="button"
          onClick={() => void downloadPng()}
          disabled={!exportSvg || exporting}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.mermaid.exporting') : t('tools.mermaid.downloadPng')}
        </button>
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.mermaid.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.mermaid.placeholder')}
          rows={16}
        />
        <div className="flex min-h-[16rem] min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.mermaid.preview')}
          </span>
          <div
            className="overflow-auto rounded-md border border-gray-200 dark:border-gray-700"
            style={{ minHeight: '28rem', background: theme.background }}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
            }}
          >
            {!validated.ok ? (
              <p className="p-3 text-sm text-gray-400">{t('tools.mermaid.empty')}</p>
            ) : renderError ? (
              <p
                role="alert"
                className="whitespace-pre-wrap p-3 text-sm text-red-600 dark:text-red-400"
              >
                {t('tools.mermaid.err.RENDER', { message: renderError })}
              </p>
            ) : svg ? (
              <div
                style={{
                  width: size.width * zoom,
                  height: size.height * zoom,
                  padding: 16 * zoom,
                  boxSizing: 'content-box',
                }}
              >
                <div
                  style={{
                    width: size.width,
                    height: size.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                  className="[&_svg]:h-auto [&_svg]:max-w-none"
                  // Mermaid 输出为受信库生成的静态 SVG
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            ) : (
              <p className="p-3 text-sm text-gray-400">{t('tools.mermaid.rendering')}</p>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.mermaid.zoomHint')}</p>
        </div>
      </div>
    </div>
  );
}
