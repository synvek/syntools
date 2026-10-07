import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import {
  adjustsFor,
  paramValue,
  projectAdjust,
  type ShapeAdjustDef,
  type ShapeDef,
} from '../model/shapes';
import type { FlowNodeStyle } from '../model/types';

/**
 * 形状可调参数手柄（类 draw.io 的黄色调整顶点）。
 *
 * 仅单选图形时渲染；每个参数一个手柄，位置与拖拽投影由 `ShapeDef.adjust` 声明反推，
 * 因此新增形状无需在此改动。拖拽过程合并为一次撤销（pointerdown 时 commit）。
 */
export function ShapeAdjustHandles({
  nodeId,
  def,
  style,
  w,
  h,
  containerRef,
}: {
  nodeId: string;
  def: ShapeDef;
  style: FlowNodeStyle;
  w: number;
  h: number;
  /** 节点根节点引用：用于把指针屏幕坐标换算回节点本地坐标（自动适配缩放与父偏移） */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const adjusts = adjustsFor(def);
  const dragging = useRef<{
    adj: ShapeAdjustDef;
    rect: DOMRect;
    w: number;
    h: number;
  } | null>(null);

  if (adjusts.length === 0) return null;

  const valueOf = (adj: ShapeAdjustDef) => paramValue(def, style, adj.key, w, h);

  const onDown = (adj: ShapeAdjustDef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = containerRef.current;
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    // 会话起点提交历史，pointermove 期间不再入栈（与 NodeResizer 一致）
    useFlowStore.getState().commit();
    dragging.current = { adj, rect: el.getBoundingClientRect(), w, h };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragging.current;
    if (!d) return;
    e.stopPropagation();
    const { rect, adj } = d;
    if (rect.width <= 0 || rect.height <= 0) return;
    const localX = ((e.clientX - rect.left) / rect.width) * d.w;
    const localY = ((e.clientY - rect.top) / rect.height) * d.h;
    const value = projectAdjust(adj, localX, localY, d.w, d.h);
    useFlowStore
      .getState()
      .setNodeParams([nodeId], { [adj.key]: Math.round(value * 1000) / 1000 }, false);
  };

  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <>
      {adjusts.map((adj) => {
        const pos = adj.anchor(w, h, valueOf(adj));
        const label = t(`tools.flowchart.shapeParam.${adj.labelKey}`);
        return (
          <button
            key={adj.key}
            type="button"
            data-testid={`flowchart-adjust-${adj.key}`}
            aria-label={label}
            title={`${label}${t('tools.flowchart.shapeParamHint')}`}
            className="shape-adjust nodrag nopan"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={onDown(adj)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={(e) => {
              e.stopPropagation();
              useFlowStore.getState().clearNodeParam([nodeId], adj.key);
            }}
          >
            <span className="shape-adjust__dot" />
          </button>
        );
      })}
    </>
  );
}
