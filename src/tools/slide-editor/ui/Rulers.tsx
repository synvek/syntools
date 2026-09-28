import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSlideStore } from '../store';

/**
 * 标尺与手动参考线。
 *
 * 标尺是 DOM 覆盖层（画布是 Konva，不适合画刻度文字）：
 * - 顶部标尺拖动 → 新建纵向参考线；左侧标尺拖动 → 新建横向参考线；
 * - 参考线以刻度三角形留在标尺上，双击即可删除；
 * - 参考线本身由 Konva 画在内容层（见 render/overlays.ts drawCustomGuides）。
 */

const RULER_SIZE = 20;
/** 标尺主刻度间隔（页面 px） */
const MAJOR_STEP = 120;

interface Draft {
  axis: 'x' | 'y';
  position: number;
}

export function Rulers({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const viewport = useSlideStore((s) => s.viewport);
  const guides = useSlideStore((s) => s.guides);
  const showRulers = useSlideStore((s) => s.showRulers);
  const addGuide = useSlideStore((s) => s.addGuide);
  const removeGuide = useSlideStore((s) => s.removeGuide);

  const [draft, setDraft] = useState<Draft | null>(null);
  const dragAxis = useRef<'x' | 'y' | null>(null);

  const scale = viewport.scale > 0 ? viewport.scale : 0;
  const originX = Math.max(0, (viewport.width - doc.width * scale) / 2) + (viewport.panX ?? 0);
  const originY = Math.max(0, (viewport.height - doc.height * scale) / 2) + (viewport.panY ?? 0);

  const toPage = useCallback(
    (axis: 'x' | 'y', clientPos: number): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      const local = clientPos - (axis === 'x' ? (rect?.left ?? 0) : (rect?.top ?? 0));
      const origin = axis === 'x' ? originX : originY;
      if (scale <= 0) return 0;
      return (local - origin) / scale;
    },
    [containerRef, originX, originY, scale],
  );

  // 拖动期间监听 window，指针移出标尺也能继续调整
  useEffect(() => {
    if (!dragAxis.current) return;
    const axis = dragAxis.current;
    const move = (event: PointerEvent) => {
      setDraft({ axis, position: toPage(axis, axis === 'x' ? event.clientX : event.clientY) });
    };
    const up = () => {
      dragAxis.current = null;
      setDraft((current) => {
        if (current) {
          const limit = current.axis === 'x' ? doc.width : doc.height;
          const clamped = Math.min(Math.max(0, current.position), limit);
          addGuide(current.axis, clamped);
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [addGuide, doc.height, doc.width, toPage]);

  if (!showRulers) return null;

  const ticks = (size: number): number[] => {
    const limit = Math.max(size, MAJOR_STEP);
    const result: number[] = [];
    for (let value = 0; value <= limit; value += MAJOR_STEP) result.push(value);
    return result;
  };

  const strip = (axis: 'x' | 'y') => {
    const size = axis === 'x' ? doc.width : doc.height;
    const origin = axis === 'x' ? originX : originY;
    const length = axis === 'x' ? viewport.width : viewport.height;
    return (
      <div
        key={axis}
        className="absolute z-10 bg-white/85 select-none dark:bg-gray-900/85"
        style={
          axis === 'x'
            ? { top: 0, left: 0, width: length, height: RULER_SIZE, cursor: 'ew-resize' }
            : { top: 0, left: 0, width: RULER_SIZE, height: length, cursor: 'ns-resize' }
        }
        onPointerDown={(event) => {
          event.preventDefault();
          dragAxis.current = axis;
          setDraft({ axis, position: toPage(axis, axis === 'x' ? event.clientX : event.clientY) });
        }}
        aria-label={`${t('tools.slide.showRulers')} ${axis}`}
      >
        {ticks(size).map((value) => {
          const screen = origin + value * scale;
          return (
            <div key={value}>
              <span
                className="absolute bg-gray-400 dark:bg-gray-600"
                style={
                  axis === 'x'
                    ? { left: screen, top: RULER_SIZE - 6, width: 1, height: 6 }
                    : { top: screen, left: RULER_SIZE - 6, height: 1, width: 6 }
                }
              />
              <span
                className="absolute text-[9px] leading-none text-gray-400 dark:text-gray-500"
                style={axis === 'x' ? { left: screen + 2, top: 2 } : { top: screen + 2, left: 2 }}
              >
                {value}
              </span>
            </div>
          );
        })}

        {/* 已有参考线在标尺上的落点：双击删除 */}
        {guides
          .filter((guide) => guide.axis === axis)
          .map((guide) => (
            <span
              key={guide.id}
              onDoubleClick={() => removeGuide(guide.id)}
              title={`${t('tools.slide.addGuide')} ${Math.round(guide.position)}`}
              className="absolute bg-sky-500"
              style={
                axis === 'x'
                  ? {
                      left: origin + guide.position * scale - 1,
                      top: 0,
                      width: 2,
                      height: RULER_SIZE,
                    }
                  : {
                      top: origin + guide.position * scale - 1,
                      left: 0,
                      height: 2,
                      width: RULER_SIZE,
                    }
              }
            />
          ))}

        {draft && draft.axis === axis ? (
          <span
            className="absolute bg-rose-500"
            style={
              axis === 'x'
                ? {
                    left: origin + draft.position * scale - 1,
                    top: 0,
                    width: 2,
                    height: RULER_SIZE,
                  }
                : {
                    top: origin + draft.position * scale - 1,
                    left: 0,
                    height: 2,
                    width: RULER_SIZE,
                  }
            }
          />
        ) : null}
      </div>
    );
  };

  return (
    <>
      {strip('x')}
      {strip('y')}
      {/* 左上角方块，遮住两条标尺的交叠 */}
      <div
        className="absolute left-0 top-0 z-20 bg-white dark:bg-gray-900"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
    </>
  );
}
