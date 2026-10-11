import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { ViewMode } from './draft';
import { MM_TO_PX, type PageMargins, type PageMetrics } from './pageSetup';

/**
 * 水平标尺（对标 Word 的标尺）：按当前纸张 / 页边距 / 缩放显示毫米刻度，
 * 便于排版时对齐；页面视图下还会把左右页边距画成灰区，并用细线标出光标位置。
 *
 * 坐标系说明：标尺渲染在滚动容器（`.rte-editor-viewport`）内、用 sticky 贴顶，
 * 位置与宽度都取自**实测屏幕矩形**（页面视图取纸面，流式视图取正文列），
 * 因此 CSS `zoom`、横向滚动、分栏切换都会自动跟随，不必手工换算缩放系数。
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
  /** 纸面 / 正文列相对滚动容器的左边距（屏幕像素） */
  offsetLeft: number;
  /** 标尺总宽（页面视图 = 纸宽；流式视图 = 正文内容宽） */
  width: number;
  /** 左右页边距对应的宽度（流式视图没有页边距概念，为 0） */
  padLeft: number;
  padRight: number;
  /** 正文内容区左边缘的屏幕 x：用于把光标位置映射到刻度上 */
  contentScreenLeft: number;
}

/** 流式视图下正文列的左右内边距（对应 `.rte-surface` 的 `px-8`） */
const FLOW_PADDING_PX = 32;
/** 低于该宽度就没必要画刻度（窗口极窄或内容区被压扁时） */
const MIN_RULER_WIDTH_PX = 140;

export function RulerBar({ editor, viewportRef, viewMode, zoom, metrics, margin }: RulerBarProps) {
  const [geo, setGeo] = useState<RulerGeometry | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
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
    const width = paged ? surfaceRect.width : surfaceRect.width - padLeft - padRight;
    if (!Number.isFinite(width) || width < MIN_RULER_WIDTH_PX) {
      setGeo(null);
      return;
    }
    setGeo({
      offsetLeft: surfaceRect.left - viewportRect.left + (paged ? 0 : padLeft),
      width,
      padLeft: paged ? padLeft : 0,
      padRight: paged ? padRight : 0,
      contentScreenLeft: surfaceRect.left + padLeft,
    });
  }, [margin.left, margin.right, viewMode, viewportRef, zoom]);

  /** 光标位置 → 刻度上的偏移（相对正文内容区左边缘） */
  const syncCaret = useCallback(() => {
    const geometry = geoRef.current;
    if (!editor || !geometry) {
      setCaret(null);
      return;
    }
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    setCaret(Math.round(coords.left - geometry.contentScreenLeft));
  }, [editor]);

  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(viewport);
    const surface = viewport.querySelector<HTMLElement>('.rte-surface');
    if (surface) observer?.observe(surface);
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
  // 每厘米一个数字标签（Word 标尺的数字即厘米值）
  const labels: number[] = [];
  for (let cm = 1; cm * cmPx <= contentWidth - 6; cm += 1) labels.push(cm);
  const caretVisible = caret !== null && caret >= 0 && caret <= contentWidth;

  return (
    <div className="rte-ruler" data-testid="rich-text-ruler" aria-hidden="true">
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
            <span className="rte-ruler-caret" style={{ left: `${caret}px` }} />
          ) : null}
        </span>
        {geo.padRight > 0 ? (
          <span className="rte-ruler-pad" style={{ width: `${geo.padRight}px` }} />
        ) : null}
      </div>
    </div>
  );
}
