import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { angleFromCenter, normalizeRotation, snapRotation } from '../core';
import { ROTATION_FINE_STEP, ROTATION_SNAP_STEP, type FlowNodeStyle } from '../model/types';

/**
 * 手柄相对节点顶边的距离（px）。
 * 需同时避开顶边中点的缩放把手与「向上」快连箭头（18×18、中心在顶边上方 18px）：
 * 取 40 让手柄底边（-31）位于快连箭头顶边（-27）之上，否则手柄会抢走箭头的指针事件。
 */
const HANDLE_OFFSET = 40;

/**
 * 节点旋转手柄（类 Figma / draw.io 的旋转顶点）。
 *
 * - 拖拽时按「指针相对节点中心的方位角」旋转，拖动过程合并为一次撤销；
 * - 默认 15° 吸附，按住 Shift 以 45° 步进，按住 Alt 自由角度；
 * - 拖动过程显示角度读数，双击复位到 0°。
 *
 * 手柄渲染在**未旋转**的外层容器上（与缩放把手、连线锚点一致），
 * 因此旋转后手柄位置依然可预期、可命中。
 */
export function ShapeRotateHandle({
  nodeId,
  style,
  containerRef,
}: {
  nodeId: string;
  style: FlowNodeStyle;
  /** 节点根节点引用：用于把指针屏幕坐标换算回节点本地坐标（自动适配缩放与父偏移） */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const [reading, setReading] = useState<number | null>(null);
  const dragging = useRef<{
    rect: DOMRect;
    /** 按下时的指针方位角（度） */
    startAngle: number;
    /** 按下时的节点角度（度） */
    startRotation: number;
  } | null>(null);

  const rotation = normalizeRotation(style.rotation ?? 0);
  const label = t('tools.flowchart.rotation');

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = containerRef.current;
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    // 会话起点提交历史，pointermove 期间不再入栈（与形状调整手柄一致）
    useFlowStore.getState().commit();
    const rect = el.getBoundingClientRect();
    dragging.current = {
      rect,
      startAngle: angleFromCenter(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        e.clientX,
        e.clientY,
      ),
      startRotation: rotation,
    };
    setReading(rotation);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragging.current;
    if (!d) return;
    e.stopPropagation();
    const { rect } = d;
    if (rect.width <= 0 || rect.height <= 0) return;
    const angle = angleFromCenter(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      e.clientX,
      e.clientY,
    );
    // 用「相对位移」而非绝对方位角，避免按下瞬间图形跳到指针方向
    const raw = d.startRotation + (angle - d.startAngle);
    const next = e.altKey
      ? normalizeRotation(raw)
      : snapRotation(raw, e.shiftKey ? ROTATION_FINE_STEP : ROTATION_SNAP_STEP);
    setReading(next);
    useFlowStore.getState().setNodeTransform([nodeId], { rotation: next }, false);
  };

  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = null;
    setReading(null);
    useFlowStore.getState().commit();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <button
      type="button"
      data-testid="flowchart-rotate-handle"
      aria-label={label}
      title={`${label} · ${t('tools.flowchart.rotateHint')}`}
      className="shape-rotate nodrag nopan"
      style={{ top: -HANDLE_OFFSET }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useFlowStore.getState().setNodeTransform([nodeId], { rotation: undefined });
      }}
    >
      <span className="shape-rotate__dot" />
      {reading !== null ? (
        <span className="shape-rotate__readout" data-testid="flowchart-rotate-readout">
          {Math.round(reading)}°
        </span>
      ) : null}
    </button>
  );
}
