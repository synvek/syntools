import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

/**
 * 文档类编辑器通用的「放映」全屏层（幻灯片工具是最早的实现，这里抽成公共组件）。
 *
 * 约定：
 * - 整屏深色背景 + 居中内容，内容自身决定底色（如白底 A4 / 白底表格）；
 * - `Esc` 退出，右上角同时提供退出按钮；
 * - 内容生成可能是异步的（截图 / 合成），用 `loading` 与 `failed` 呈现中间态；
 * - 底部 `footer` 放工具自定义操作（翻页、切换工作表等）；
 * - 缩放：右上角「缩小 / 百分比 / 放大 / 适应窗口」，并支持 `+` `-` `0` 快捷键
 *   与 Ctrl / ⌘ + 滚轮；`zoom = 1` 即「适应窗口」，内容默认铺满可视区。
 *   缩放以「锚点」为基准：滚轮取光标位置，按钮 / 快捷键取可视区中心
 *   （居顶内容则取可视区顶部）；缩放后补偿滚动偏移，锚点处的内容不会跑位。
 *   放大采用「布局盒撑出滚动区 + 内容整体 scale」两层结构，
 *   这样文字 / 表格这类固定尺寸内容也会真正变大，而不只是多出一块空白。
 */

export interface PresentOverlayProps {
  /** 左上角标题（通常为文档名） */
  title: string;
  onClose: () => void;
  /** 退出按钮文案（含 Esc 提示） */
  exitLabel: string;
  /** 内容生成中的提示 */
  loadingLabel?: string;
  /** 内容生成失败的提示 */
  failedLabel?: string;
  /** 失败时的补充说明（如建议降低画布尺寸） */
  failedHint?: string;
  loading?: boolean;
  failed?: boolean;
  /** 内容对齐：文档类居顶更像「一页纸」，图形类居中更像投影（默认居中） */
  align?: 'center' | 'top';
  /** 底部操作区 */
  footer?: ReactNode;
  children?: ReactNode;
}

/** 缩放范围（1 = 适应窗口） */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
/** 按钮 / 快捷键单步倍率 */
const ZOOM_STEP = 1.25;
/** Ctrl / ⌘ + 滚轮单步倍率：滚一格位移更细，避免一滚就跳过头 */
const ZOOM_WHEEL_STEP = 1.02;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/** 缩放前记录的锚点：把同一内容点在缩放后钉回原来的屏幕位置 */
interface ZoomAnchor {
  /** 锚点在舞台内的相对位置（可落在内容之外，故不做 0~1 截断） */
  fx: number;
  fy: number;
  /** 锚点的屏幕坐标（viewport 视口系） */
  clientX: number;
  clientY: number;
}

export function PresentOverlay({
  title,
  onClose,
  exitLabel,
  loadingLabel,
  failedLabel,
  failedHint,
  loading = false,
  failed = false,
  align = 'center',
  footer,
  children,
}: PresentOverlayProps) {
  const { t } = useTranslation();
  /** 相对「适应窗口」的缩放比例，1 表示内容正好铺满可视区 */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);

  /**
   * 应用新缩放。默认锚点与内容对齐方式一致：居顶内容锚「可视区顶部」，
   * 居中内容锚「可视区中心」；滚轮则直接传入光标坐标。
   * 于是缩放后锚点下的内容原地不动，而不是整页跟着漂移。
   */
  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const value = clampZoom(next);
      if (value === zoomRef.current) return;

      const stage = stageRef.current;
      const host = scrollRef.current;
      if (stage && host) {
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const hostRect = host.getBoundingClientRect();
          const clientX = anchor?.clientX ?? hostRect.left + hostRect.width / 2;
          const clientY =
            anchor?.clientY ??
            (align === 'top' ? hostRect.top : hostRect.top + hostRect.height / 2);
          pendingAnchorRef.current = {
            fx: (clientX - rect.left) / rect.width,
            fy: (clientY - rect.top) / rect.height,
            clientX,
            clientY,
          };
        }
      }

      zoomRef.current = value;
      setZoom(value);
    },
    [align],
  );

  const zoomIn = useCallback(() => applyZoom(zoomRef.current * ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current / ZOOM_STEP), [applyZoom]);
  const fitToWindow = useCallback(() => {
    pendingAnchorRef.current = null;
    zoomRef.current = 1;
    setZoom(1);
  }, []);

  // 缩放落地后（DOM 已更新、绘制前）补偿滚动偏移：把锚点拉回原屏幕位置。
  // 用 useLayoutEffect 是为了赶在绘制前完成，避免出现「先跳一下再回正」的闪烁。
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const stage = stageRef.current;
    const host = scrollRef.current;
    if (!anchor || !stage || !host) return;
    const rect = stage.getBoundingClientRect();
    const dx = rect.left + anchor.fx * rect.width - anchor.clientX;
    const dy = rect.top + anchor.fy * rect.height - anchor.clientY;
    if (dx === 0 && dy === 0) return;
    host.scrollLeft += dx;
    host.scrollTop += dy;
  }, [zoom]);

  // Ctrl / ⌘ + 滚轮缩放：浏览器默认会触发页面缩放，且 React 的 onWheel 是 passive 的
  // （无法 preventDefault），因此这里手动绑定非 passive 的原生监听。
  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const step = event.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP;
      applyZoom(zoomRef.current * step, { clientX: event.clientX, clientY: event.clientY });
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      // 缩放快捷键：`+` / `=` 放大，`-` / `_` 缩小，`0` 适应窗口
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        fitToWindow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitToWindow, onClose, zoomIn, zoomOut]);

  const ready = !loading && !failed;
  const percent = Math.round(zoom * 100);

  return (
    <div
      data-testid="present-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]"
    >
      <header className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-gray-300">
        <span className="truncate">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {ready ? (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={t('common.present.zoomFit')}
            >
              <button
                type="button"
                data-testid="present-zoom-out"
                aria-label={t('common.present.zoomOut')}
                title={t('common.present.zoomOut')}
                disabled={zoom <= ZOOM_MIN}
                onClick={zoomOut}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="zoomOut" className="h-4 w-4" />
              </button>
              <span
                data-testid="present-zoom-level"
                className="min-w-[46px] text-center text-[12px] tabular-nums text-gray-400"
              >
                {percent}%
              </span>
              <button
                type="button"
                data-testid="present-zoom-in"
                aria-label={t('common.present.zoomIn')}
                title={t('common.present.zoomIn')}
                disabled={zoom >= ZOOM_MAX}
                onClick={zoomIn}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="zoomIn" className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="present-zoom-fit"
                aria-label={t('common.present.zoomFit')}
                title={t('common.present.zoomFit')}
                onClick={fitToWindow}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800"
              >
                <Icon name="fitScreen" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            data-testid="present-exit"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-[12px] transition-colors hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
            {exitLabel}
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        data-testid="present-scroll"
        className="flex min-h-0 flex-1 overflow-auto px-6 pb-6"
        style={{
          // `safe` 关键字：放大的内容超出可视区时靠起始边对齐，避免居中导致起始部分被裁掉
          justifyContent: 'safe center',
          alignItems: align === 'top' ? 'flex-start' : 'safe center',
        }}
      >
        {loading ? <p className="text-sm text-gray-400">{loadingLabel}</p> : null}
        {failed ? (
          <div className="max-w-md text-center text-sm text-gray-400">
            <p>{failedLabel}</p>
            {failedHint ? <p className="mt-1 text-xs text-gray-500">{failedHint}</p> : null}
          </div>
        ) : null}
        {ready ? (
          // 缩放舞台：外层按倍率撑出「布局尺寸」以供滚动，内层保持原始尺寸再整体 scale，
          // 这样文字 / 表格等固定尺寸内容也会真正放大，而不只是多出一块空白。
          <div
            ref={stageRef}
            data-testid="present-stage"
            className="shrink-0"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          >
            <div
              className="flex justify-center"
              style={{
                // 内层 = 舞台尺寸 / 倍率（即原始可视区大小），再从左上角放大回铺满舞台
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`,
                alignItems: align === 'top' ? 'flex-start' : 'center',
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {children}
            </div>
          </div>
        ) : null}
      </div>

      {footer ? (
        <footer className="flex items-center justify-center gap-3 pb-4 text-[12px] text-gray-400">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
