import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import type { CanvasGuide, GuideAxis } from '../model/types';

/** 标尺刻度候选步长（画布单位） */
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** 标尺厚度（px） */
export const RULER_SIZE = 20;

/** 选一个让刻度间距不小于 minPx 屏幕像素的步长 */
function pickStep(zoom: number, minPx: number): number {
  const target = minPx / Math.max(0.05, zoom);
  return STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1];
}

/**
 * 正在拖拽的参考线下标（模块级）。
 * 用下标而非对象引用：更新时只替换被拖动的那一项，下标在整个拖拽期间稳定。
 */
let draggingGuideIndex: number | null = null;

/**
 * 顶部 / 左侧标尺。
 * 在标尺上按下并拖动即可拉出一条参考线（顶部 → 水平线，左侧 → 垂直线）。
 */
export function Ruler() {
  const { x: vx, y: vy, zoom } = useViewport();
  const hostRef = useRef<HTMLDivElement>(null);

  const startGuide = (axis: GuideAxis) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const host = hostRef.current?.parentElement?.getBoundingClientRect();
    if (!host) return;
    const pos =
      axis === 'y' ? (e.clientY - host.top - vy) / zoom : (e.clientX - host.left - vx) / zoom;
    const guide: CanvasGuide = { axis, pos: Math.round(pos) };
    // 新参考线追加在末尾，其下标在整个拖拽期间保持不变
    const initial = useFlowStore.getState().guides;
    const index = initial.length;
    draggingGuideIndex = index;
    useFlowStore.getState().setGuides([...initial, guide]);

    const onMove = (ev: PointerEvent) => {
      const rect = hostRef.current?.parentElement?.getBoundingClientRect();
      // 注意：每次都取最新状态，避免用指针按下时的旧数组覆盖掉刚加入的参考线
      const st = useFlowStore.getState();
      if (!rect || draggingGuideIndex === null) return;
      const raw =
        axis === 'y' ? (ev.clientY - rect.top - vy) / zoom : (ev.clientX - rect.left - vx) / zoom;
      const snap = st.gridEnabled && st.gridSize > 1 ? st.gridSize : 1;
      const snapped = Math.round(raw / snap) * snap;
      const idx = draggingGuideIndex;
      if (idx < 0 || idx >= st.guides.length) return;
      st.setGuides(st.guides.map((g, i) => (i === idx ? { ...g, pos: snapped } : g)));
    };
    const onUp = () => {
      draggingGuideIndex = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const step = pickStep(zoom, 60);
  const topTicks: number[] = [];
  const host = hostRef.current?.parentElement;
  const width = host?.clientWidth ?? 1200;
  const height = host?.clientHeight ?? 600;
  const startX = Math.floor(-vx / zoom / step) * step;
  const startY = Math.floor(-vy / zoom / step) * step;
  for (let x = startX; x * zoom + vx <= width; x += step) topTicks.push(x);
  const leftTicks: number[] = [];
  for (let y = startY; y * zoom + vy <= height; y += step) leftTicks.push(y);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <div
        data-testid="flowchart-ruler-top"
        className="pointer-events-auto absolute left-0 top-0 cursor-ns-resize border-b border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/90"
        style={{ height: RULER_SIZE, right: 0 }}
        onPointerDown={startGuide('y')}
        title="拖动以创建水平参考线"
      >
        {topTicks.map((x) => (
          <span
            key={x}
            className="absolute top-0 select-none text-[9px] text-gray-400"
            style={{ left: x * zoom + vx + 2 }}
          >
            {x}
          </span>
        ))}
      </div>
      <div
        data-testid="flowchart-ruler-left"
        className="pointer-events-auto absolute left-0 top-0 cursor-ew-resize border-r border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/90"
        style={{ width: RULER_SIZE, bottom: 0 }}
        onPointerDown={startGuide('x')}
        title="拖动以创建垂直参考线"
      >
        {leftTicks.map((y) => (
          <span
            key={y}
            className="absolute left-0 w-full select-none pl-0.5 text-[9px] text-gray-400"
            style={{ top: y * zoom + vy }}
          >
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 持久参考线：细虚线，可拖动；双击删除 */
export function GuideLines() {
  const guides = useFlowStore((s) => s.guides);
  const { x: vx, y: vy, zoom } = useViewport();
  if (guides.length === 0) return null;

  /** 删除第 index 条参考线（按下标，避免对象引用比较失效） */
  const removeAt = (index: number) => {
    const st = useFlowStore.getState();
    st.setGuides(st.guides.filter((_, i) => i !== index));
  };

  /** 拖动第 index 条参考线（每次读取最新状态） */
  const move = (index: number, e: ReactPointerEvent) => {
    e.stopPropagation();
    const container = (e.currentTarget as HTMLElement).parentElement;
    const onMove = (ev: PointerEvent) => {
      const rect = container?.getBoundingClientRect();
      const st = useFlowStore.getState();
      const guide = st.guides[index];
      if (!rect || !guide) return;
      const raw =
        guide.axis === 'y'
          ? (ev.clientY - rect.top - vy) / zoom
          : (ev.clientX - rect.left - vx) / zoom;
      const snap = st.gridEnabled && st.gridSize > 1 ? st.gridSize : 1;
      const snapped = Math.round(raw / snap) * snap;
      st.setGuides(st.guides.map((g, i) => (i === index ? { ...g, pos: snapped } : g)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[45]" aria-hidden="true">
      {guides.map((g, i) =>
        g.axis === 'y' ? (
          <div
            key={`y-${i}`}
            data-testid="flowchart-guide-y"
            className="pointer-events-auto absolute left-0 right-0 h-px cursor-ns-resize bg-sky-400/80"
            style={{ top: g.pos * zoom + vy }}
            onPointerDown={(e) => move(i, e)}
            onDoubleClick={() => removeAt(i)}
          />
        ) : (
          <div
            key={`x-${i}`}
            data-testid="flowchart-guide-x"
            className="pointer-events-auto absolute bottom-0 top-0 w-px cursor-ew-resize bg-sky-400/80"
            style={{ left: g.pos * zoom + vx }}
            onPointerDown={(e) => move(i, e)}
            onDoubleClick={() => removeAt(i)}
          />
        ),
      )}
    </div>
  );
}
