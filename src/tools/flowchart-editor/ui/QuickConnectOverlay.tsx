import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '../store';
import { useQuickConnect } from '../quickConnect';
import { absolutePositionOf } from '../core';
import { shapeDefOf, shapesOfCategory, shapeSize, type ShapeDef } from '../model/shapes';
import type { FlowEdgeStyle, ShapeKind } from '../model/types';
import { drawShape } from '../nodes/shapeDraw';

/** 弹窗尺寸估算，用于边界收敛 */
const PICKER_W = 228;
const PICKER_H = 268;

/** 拖拽预览路径：跟随当前默认线型（直线 / 折线 / 圆角折线 / 曲线） */
function previewPath(
  type: FlowEdgeStyle['type'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  switch (type) {
    case 'straight':
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    case 'bezier': {
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    }
    case 'step': {
      const mx = (x1 + x2) / 2;
      return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
    }
    case 'smoothstep':
    default: {
      const mx = (x1 + x2) / 2;
      const sy = y2 >= y1 ? 1 : -1;
      const r = Math.max(0, Math.min(10, Math.abs(mx - x1), Math.abs(y2 - y1) / 2));
      return [
        `M ${x1} ${y1}`,
        `L ${mx - r} ${y1}`,
        `Q ${mx} ${y1} ${mx} ${y1 + sy * r}`,
        `L ${mx} ${y2 - sy * r}`,
        `Q ${mx} ${y2} ${mx + r} ${y2}`,
        `L ${x2} ${y2}`,
      ].join(' ');
    }
  }
}

function Glyph({ def }: { def: ShapeDef }) {
  const w = def.size.width;
  const h = def.size.height;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-6 w-6"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="#EFF6FF" stroke="#2563EB" strokeWidth={Math.max(2, w / 38)}>
        {drawShape(def, w, h)}
      </g>
    </svg>
  );
}

/**
 * 悬停快速连线：按住箭头拖出预览线（线型跟随工具栏），松手立即生成相连节点与连线，
 * 同时弹出图形选择弹窗（源图形所在分类）——选择后替换该新节点类型。
 */
export function QuickConnectOverlay() {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const rootRef = useRef<HTMLDivElement>(null);
  const draft = useQuickConnect((s) => s.draft);
  const picker = useQuickConnect((s) => s.picker);
  const closePicker = useQuickConnect((s) => s.closePicker);
  const nodes = useFlowStore((s) => s.nodes);
  const defaultEdge = useFlowStore((s) => s.defaultEdge);
  const edgeType = defaultEdge.type;

  const active = draft !== null;
  const pickerSource = picker ? nodes.find((n) => n.id === picker.sourceId) : undefined;
  const category = pickerSource ? shapeDefOf(pickerSource.data.kind)?.category : undefined;
  const shapes = category ? shapesOfCategory(category) : [];

  // 拖拽期间：监听全局指针，松手时立即建节点+连线并打开选择弹窗
  useEffect(() => {
    if (!active) return;
    const onMove = (ev: PointerEvent) => useQuickConnect.getState().move(ev.clientX, ev.clientY);
    const onUp = (ev: PointerEvent) => {
      const st = useQuickConnect.getState();
      const d = st.draft;
      const root = rootRef.current;
      if (!d || !root) {
        st.cancel();
        return;
      }
      const rect = root.getBoundingClientRect();
      const all = useFlowStore.getState().nodes;
      const src = all.find((n) => n.id === d.sourceId);
      if (!src) {
        st.cancel();
        return;
      }
      const size = shapeSize(src.data.kind);
      let centerX: number;
      let centerY: number;
      if (d.moved) {
        const fp = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        centerX = fp.x;
        centerY = fp.y;
      } else {
        // 未拖动（点击箭头）：按方向放在源图形外侧
        const byId = new Map(all.map((n) => [n.id, n] as const));
        const abs = absolutePositionOf(src, byId);
        const gap = 48;
        const off = {
          up: { x: 0, y: -(size.height + gap) },
          down: { x: 0, y: size.height + gap },
          left: { x: -(size.width + gap), y: 0 },
          right: { x: size.width + gap, y: 0 },
        }[d.dir];
        centerX = abs.x + off.x + size.width / 2;
        centerY = abs.y + off.y + size.height / 2;
      }
      // 立即生成相连节点与连线（默认同类型，稍后由弹窗替换类型）
      const nodeId = useFlowStore.getState().spawnConnectedNode(d.sourceId, {
        x: Math.round((centerX - size.width / 2) / 10) * 10,
        y: Math.round((centerY - size.height / 2) / 10) * 10,
      });
      if (!nodeId) {
        st.cancel();
        return;
      }
      const px = Math.min(
        Math.max(ev.clientX - rect.left, 8),
        Math.max(8, rect.width - PICKER_W - 8),
      );
      const py = Math.min(
        Math.max(ev.clientY - rect.top, 8),
        Math.max(8, rect.height - PICKER_H - 8),
      );
      st.openPicker({ sourceId: d.sourceId, nodeId, x: px, y: py });
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') useQuickConnect.getState().cancel();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, screenToFlowPosition]);

  const pick = (kind: ShapeKind) => {
    if (picker) useFlowStore.getState().changeNodeKind(picker.nodeId, kind);
    closePicker();
  };

  const rect = rootRef.current?.getBoundingClientRect();

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-40">
      {draft && rect ? (
        <svg className="absolute inset-0 h-full w-full">
          <path
            d={previewPath(
              edgeType,
              draft.startX - rect.left,
              draft.startY - rect.top,
              draft.curX - rect.left,
              draft.curY - rect.top,
            )}
            fill="none"
            stroke="#2563EB"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <circle cx={draft.curX - rect.left} cy={draft.curY - rect.top} r={4} fill="#2563EB" />
        </svg>
      ) : null}

      {picker && category ? (
        <>
          <div
            className="pointer-events-auto absolute inset-0"
            onPointerDown={() => closePicker()}
          />
          <div
            data-testid="quick-picker"
            className="pointer-events-auto absolute w-[228px] rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
            style={{ left: picker.x, top: picker.y }}
          >
            <div className="mb-1.5 px-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              {t(`tools.flowchart.cat_${category}`)}
            </div>
            <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto p-0.5">
              {shapes.map((def) => (
                <button
                  key={def.kind}
                  type="button"
                  title={t(`tools.flowchart.shape_${def.kind}`)}
                  onClick={() => pick(def.kind)}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white p-1 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/60"
                >
                  <Glyph def={def} />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
