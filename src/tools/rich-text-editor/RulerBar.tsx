import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { ViewMode } from './draft';
import { MM_TO_PX, type PageMargins, type PageMetrics } from './pageSetup';

/**
 * 标尺（对标 Word）：顶部水平标尺 + 左侧垂直标尺，按当前纸张 / 页边距 / 缩放显示毫米刻度，
 * 页面视图下把页边距画成灰区，并用细线标出光标位置，便于排版时对齐。
 *
 * 坐标系：两条标尺都渲染在滚动容器（`.rte-editor-viewport`）内。
 * - 水平标尺用 sticky 贴顶（纵向滚动不移动）；
 * - 垂直标尺用 absolute 钉在容器上（absolute 的包含块是容器的 padding box，不随滚动移动），
 *   刻度层再按实测的内容顶部位置上下平移，于是滚动时数字会跟着正文走。
 * 位置与尺寸全部取自实测屏幕矩形，因此 CSS `zoom`、横向 / 纵向滚动、分栏切换都会自动跟随。
 */

interface RulerBarProps {
  editor: Editor | null;
  viewportRef: RefObject<HTMLDivElement | null>;
  viewMode: ViewMode;
  zoom: number;
  metrics: PageMetrics;
  margin: PageMargins;
}

interface RulerGeometry {
  /** 纸面 / 正文列相对滚动容器的左边距与总宽（屏幕像素） */
  offsetLeft: number;
  width: number;
  /** 左右页边距宽度（流式视图为 0） */
  padLeft: number;
  padRight: number;
  /** 正文内容区左边缘的屏幕 x：用于把光标位置映射到刻度上 */
  contentScreenLeft: number;
  /** 正文内容区顶部相对滚动容器顶部的偏移（随滚动变化） */
  offsetTop: number;
  /** 正文内容区高度（屏幕像素） */
  contentHeight: number;
  /** 上下页边距高度（流式视图为 0） */
  padTop: number;
  padBottom: number;
  /** 正文内容区顶部的屏幕 y */
  contentScreenTop: number;
  /** 当前纵向滚动偏移：滚动容器内的 absolute 元素会随内容一起移动，需要反向补偿 */
  scrollTop: number;
}

/** 流式视图下正文列的左右内边距（对应 `.rte-surface` 的 `px-8`）与上下内边距（`py-8`） */
const FLOW_PADDING_PX = 32;
/** 低于该尺寸就没必要画刻度（窗口极窄或内容区被压扁时） */
const MIN_RULER_WIDTH_PX = 140;
const MIN_RULER_HEIGHT_PX = 120;

export function RulerBar({ editor, viewportRef, viewMode, zoom, metrics, margin }: RulerBarProps) {
  const [geo, setGeo] = useState<RulerGeometry | null>(null);
  const [caret, setCaret] = useState<{ x: number; y: number } | null>(null);
  const geoRef = useRef<RulerGeometry | null>(null);
  const frameRef = useRef<number | null>(null);
  geoRef.current = geo;

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const surface = viewport?.querySelector<HTMLElement>('.rte-surface');
    if (!viewport || !surface) {
      setGeo(null);
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    // 屏幕像素 = CSS 像素 × zoom；这里直接测量缩放后的矩形，故 scale 只用于页边距换算
    const scale = MM_TO_PX * zoom;
    const paged = viewMode === 'paged';
    const padLeft = paged ? margin.left * scale : FLOW_PADDING_PX * zoom;
    const padRight = paged ? margin.right * scale : FLOW_PADDING_PX * zoom;
    const padTop = paged ? margin.top * scale : FLOW_PADDING_PX * zoom;
    const padBottom = paged ? margin.bottom * scale : FLOW_PADDING_PX * zoom;
    const width = paged ? surfaceRect.width : surfaceRect.width - padLeft - padRight;
    const contentHeight = paged ? surfaceRect.height - padTop - padBottom : surfaceRect.height;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(contentHeight) ||
      width < MIN_RULER_WIDTH_PX ||
      contentHeight < MIN_RULER_HEIGHT_PX
    ) {
      setGeo(null);
      return;
    }
    setGeo({
      offsetLeft: surfaceRect.left - viewportRect.left + (paged ? 0 : padLeft),
      width,
      padLeft: paged ? padLeft : 0,
      padRight: paged ? padRight : 0,
      contentScreenLeft: surfaceRect.left + padLeft,
      offsetTop: surfaceRect.top - viewportRect.top + padTop,
      contentHeight,
      padTop: paged ? padTop : 0,
      padBottom: paged ? padBottom : 0,
      contentScreenTop: surfaceRect.top + padTop,
      scrollTop: viewport.scrollTop,
    });
  }, [margin.bottom, margin.left, margin.right, margin.top, viewMode, viewportRef, zoom]);

  /**
   * 水平标尺要等首次 measure 后（geo 非空）才会挂载，所以不能在 effect 里用
   * `viewport.querySelector('.rte-ruler')` 观察它（那时还查不到，垂直标尺刻度会一直按
   * 「标尺高度为 0」的旧几何定位，与正文错开约 20px）。改用回调 ref：节点一挂载就观察。
   */
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const rulerObserverRef = useRef<ResizeObserver | null>(null);
  const attachRuler = useCallback((node: HTMLDivElement | null) => {
    rulerObserverRef.current?.disconnect();
    rulerObserverRef.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureRef.current());
    observer.observe(node);
    rulerObserverRef.current = observer;
  }, []);

  /** 光标位置 → 两条标尺上的偏移（相对正文内容区左 / 上边缘） */
  const syncCaret = useCallback(() => {
    const geometry = geoRef.current;
    if (!editor || !geometry) {
      setCaret(null);
      return;
    }
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    setCaret({
      x: Math.round(coords.left - geometry.contentScreenLeft),
      y: Math.round(coords.top - geometry.contentScreenTop),
    });
  }, [editor]);

  useEffect(() => {
    measure();
    // 布局（尤其水平标尺高度）常在首帧后才稳定，强制下一帧再算一次，
    // 否则垂直标尺刻度会与正文错位（vOffset 偏差可达 ~20px）。
    requestAnimationFrame(() => measure());
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(viewport);
    const surface = viewport.querySelector<HTMLElement>('.rte-surface');
    if (surface) observer?.observe(surface);
    // 水平标尺高度变化会把正文区整体下移，但 surface 自身尺寸不变，
    // 需要单独观察标尺；标尺由 attachRuler 在挂载时接管观察。
    // 滚动事件不冒泡，用捕获阶段同时覆盖内层横向滚动（.rte-page-area）
    const onScroll = () => measure();
    viewport.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure, viewportRef, metrics, viewMode]);

  useEffect(() => {
    syncCaret();
  }, [geo, syncCaret]);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        syncCaret();
      });
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [editor, syncCaret]);

  if (!geo) return null;

  const mmPx = MM_TO_PX * zoom;
  const cmPx = mmPx * 10;
  const contentWidth = geo.width - geo.padLeft - geo.padRight;
  const contentHeight = geo.contentHeight;
  // 每厘米一个数字标签（Word 标尺的数字即厘米值）
  const labels: number[] = [];
  for (let cm = 1; cm * cmPx <= contentWidth - 6; cm += 1) labels.push(cm);
  const vLabels: number[] = [];
  for (let cm = 1; cm * cmPx <= contentHeight - 6; cm += 1) vLabels.push(cm);
  const caretVisible =
    caret !== null &&
    caret.x >= 0 &&
    caret.x <= contentWidth &&
    caret.y >= 0 &&
    caret.y <= contentHeight;

  return (
    <>
      {/* 左上角交点 */}
      <span className="rte-ruler-corner" aria-hidden="true" />
      {/* 水平标尺 */}
      <div ref={attachRuler} className="rte-ruler" data-testid="rich-text-ruler" aria-hidden="true">
        <div
          className="rte-ruler-track"
          style={{ left: `${geo.offsetLeft}px`, width: `${geo.width}px` }}
        >
          {geo.padLeft > 0 ? (
            <span className="rte-ruler-pad" style={{ width: `${geo.padLeft}px` }} />
          ) : null}
          <span className="rte-ruler-content" style={{ width: `${contentWidth}px` }}>
            <span
              className="rte-ruler-ticks rte-ruler-ticks--minor"
              style={{ backgroundSize: `${mmPx}px 100%` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--half"
              style={{ backgroundSize: `${mmPx * 5}px 100%` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--major"
              style={{ backgroundSize: `${cmPx}px 100%` }}
            />
            {labels.map((cm) => (
              <span key={cm} className="rte-ruler-label" style={{ left: `${cm * cmPx}px` }}>
                {cm}
              </span>
            ))}
            {caretVisible ? (
              <span className="rte-ruler-caret" style={{ left: `${caret.x}px` }} />
            ) : null}
          </span>
          {geo.padRight > 0 ? (
            <span className="rte-ruler-pad" style={{ width: `${geo.padRight}px` }} />
          ) : null}
        </div>
      </div>
      {/* 垂直标尺 */}
      <div
        className="rte-ruler-v"
        data-testid="rich-text-ruler-v"
        aria-hidden="true"
        // 滚动容器里的 absolute 元素会随内容一起上移，这里反向位移把标尺钉在原地；
        // 刻度层再用 offsetTop 对齐正文内容顶部，于是滚动时数字跟着正文走。
        style={{ transform: `translateY(${geo.scrollTop}px)` }}
      >
        <div
          className="rte-ruler-track rte-ruler-track--v"
          style={{
            top: `${geo.offsetTop}px`,
            height: `${geo.padTop + contentHeight + geo.padBottom}px`,
          }}
        >
          {geo.padTop > 0 ? (
            <span className="rte-ruler-pad" style={{ height: `${geo.padTop}px` }} />
          ) : null}
          <span
            className="rte-ruler-content rte-ruler-content--v"
            style={{ height: `${contentHeight}px` }}
          >
            <span
              className="rte-ruler-ticks rte-ruler-ticks--minor rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${mmPx}px` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--half rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${mmPx * 5}px` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--major rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${cmPx}px` }}
            />
            {vLabels.map((cm) => (
              <span
                key={cm}
                className="rte-ruler-label rte-ruler-label--v"
                style={{ top: `${cm * cmPx}px` }}
              >
                {cm}
              </span>
            ))}
            {caretVisible ? (
              <span
                className="rte-ruler-caret rte-ruler-caret--v"
                style={{ top: `${caret.y}px` }}
              />
            ) : null}
          </span>
          {geo.padBottom > 0 ? (
            <span className="rte-ruler-pad" style={{ height: `${geo.padBottom}px` }} />
          ) : null}
        </div>
      </div>
    </>
  );
}
