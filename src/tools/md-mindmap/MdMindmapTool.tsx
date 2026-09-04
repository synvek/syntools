import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_THEME_ID,
  MAX_ZOOM,
  MIN_ZOOM,
  MINDMAP_THEMES,
  ZOOM_STEP,
  buildMindmap,
  clampZoom,
  getMindmapTheme,
  isMindmapThemeId,
  type MindmapThemeId,
} from './core';

const DEFAULT_MD = `# 项目计划
## 调研
- 竞品分析
- 用户访谈
## 设计
- 线框图
- 视觉稿
## 开发
- 前端
- 后端
`;

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

/** Markdown 思维导图 */
export default function MdMindmapTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ i: DEFAULT_MD, th: DEFAULT_THEME_ID, z: 1 }),
    [],
  );
  const [input, setInput] = useState(String(init.i || DEFAULT_MD));
  const [themeId, setThemeId] = useState<MindmapThemeId>(
    isMindmapThemeId(String(init.th)) ? (init.th as MindmapThemeId) : DEFAULT_THEME_ID,
  );
  const [zoom, setZoom] = useState(() => clampZoom(Number(init.z) || 1));
  const [exporting, setExporting] = useState(false);

  const result = useMemo(() => buildMindmap(input, themeId), [input, themeId]);
  const theme = getMindmapTheme(themeId);
  const svg = result.ok ? result.value.svg : '';

  const downloadSvg = () => {
    if (!result.ok) return;
    const blob = new Blob([result.value.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!result.ok) return;
    setExporting(true);
    try {
      const dataUrl = await svgStringToPngDataUrl(result.value.svg, 2);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'mindmap.png';
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
          {t('tools.mdMindmap.theme')}
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value as MindmapThemeId)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {MINDMAP_THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {t(`tools.mdMindmap.themes.${th.id}`)}
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
            aria-label={t('tools.mdMindmap.zoomOut')}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-[4.5rem] rounded-md border border-gray-300 px-2 py-1 font-mono text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t('tools.mdMindmap.zoomReset')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            aria-label={t('tools.mdMindmap.zoomIn')}
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
          disabled={!result.ok}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('tools.mdMindmap.downloadSvg')}
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={!result.ok || exporting}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.mdMindmap.exporting') : t('tools.mdMindmap.downloadPng')}
        </button>
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.mdMindmap.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.mdMindmap.placeholder')}
          rows={16}
        />
        <div className="flex min-h-[16rem] min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.mdMindmap.preview')}
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
            {result.ok ? (
              <div
                style={{
                  width: result.value.width * zoom,
                  height: result.value.height * zoom,
                  padding: 12 * zoom,
                  boxSizing: 'content-box',
                }}
              >
                <div
                  style={{
                    width: result.value.width,
                    height: result.value.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                  // SVG 由本工具纯函数生成，无外部 HTML
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            ) : input.trim() ? (
              <p role="alert" className="p-3 text-sm text-red-600 dark:text-red-400">
                {t(`tools.mdMindmap.err.${result.error}`)}
              </p>
            ) : (
              <p className="p-3 text-sm text-gray-400">{t('tools.mdMindmap.empty')}</p>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.mdMindmap.zoomHint')}</p>
        </div>
      </div>
    </div>
  );
}
