import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import type { CanvasGuide, GuideAxis } from '../model/types';

/** Candidate ruler tick steps (canvas units) */
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** Ruler thickness (px) */
export const RULER_SIZE = 20;

/** Pick a step that keeps tick spacing at least minPx screen pixels apart */
function pickStep(zoom: number, minPx: number): number {
  const target = minPx / Math.max(0.05, zoom);
  return STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1];
}

/**
 * Index of the guide being dragged (module level).
 * An index rather than an object reference: updates replace only the dragged entry, and the index is stable for the whole drag.
 */
let draggingGuideIndex: number | null = null;

/**
 * Top / left rulers.
 * Press and drag on a ruler to pull out a guide (top → horizontal line, left → vertical line).
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
    // A new guide is appended at the end, so its index stays stable for the whole drag
    const initial = useFlowStore.getState().guides;
    const index = initial.length;
    draggingGuideIndex = index;
    useFlowStore.getState().setGuides([...initial, guide]);

    const onMove = (ev: PointerEvent) => {
      const rect = hostRef.current?.parentElement?.getBoundingClientRect();
      // Note: always read the latest state, so the array captured at pointer-down does not overwrite a guide just added
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

/** Persistent guides: thin dashed lines, draggable; double-click to delete */
export function GuideLines() {
  const guides = useFlowStore((s) => s.guides);
  const { x: vx, y: vy, zoom } = useViewport();
  if (guides.length === 0) return null;

  /** Delete the guide at index (by index, so object reference comparison cannot go stale) */
  const removeAt = (index: number) => {
    const st = useFlowStore.getState();
    st.setGuides(st.guides.filter((_, i) => i !== index));
  };

  /** Drag the guide at index (reads the latest state every time) */
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
