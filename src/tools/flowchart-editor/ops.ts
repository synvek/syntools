/**
 * 排版与层级操作的纯函数：对齐、等距分布、层级重排、编组包围盒、边样式归一化。
 * 不引用 React Flow 与 DOM，全部可单测。
 */

import { DEFAULT_EDGE_STYLE, type FlowEdgeStyle, type ShapeKind } from './model/types';
import { shapeSize } from './model/shapes';

/** 节点的绝对包围盒（排版计算用，坐标需为画布绝对坐标） */
export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type LayerOp = 'front' | 'back' | 'forward' | 'backward';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 节点尺寸：优先用户调整过的尺寸，其次图形目录默认值 */
export function boxSizeOf(node: { width?: number; height?: number; data: { kind: ShapeKind } }): {
  width: number;
  height: number;
} {
  const def = shapeSize(node.data.kind);
  return { width: node.width ?? def.width, height: node.height ?? def.height };
}

/** 一组节点的整体边界；空集合返回 null */
export function groupBounds(boxes: LayoutBox[]): Omit<LayoutBox, 'id'> | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 对齐：以选中集合的整体边界为基准，返回每个节点的新位置 */
export function computeAlign(
  boxes: LayoutBox[],
  mode: AlignMode,
): Record<string, { x: number; y: number }> {
  const bounds = groupBounds(boxes);
  if (!bounds) return {};
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const hcenter = bounds.x + bounds.width / 2;
  const vcenter = bounds.y + bounds.height / 2;

  const out: Record<string, { x: number; y: number }> = {};
  for (const b of boxes) {
    let { x, y } = b;
    switch (mode) {
      case 'left':
        x = bounds.x;
        break;
      case 'right':
        x = right - b.width;
        break;
      case 'hcenter':
        x = hcenter - b.width / 2;
        break;
      case 'top':
        y = bounds.y;
        break;
      case 'bottom':
        y = bottom - b.height;
        break;
      case 'vcenter':
        y = vcenter - b.height / 2;
        break;
    }
    out[b.id] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}

/** 等距分布：少于 3 个节点时无意义，返回空 */
export function computeDistribute(
  boxes: LayoutBox[],
  axis: 'h' | 'v',
): Record<string, { x: number; y: number }> {
  if (boxes.length < 3) return {};
  const sizeOf = (b: LayoutBox) => (axis === 'h' ? b.width : b.height);
  const startOf = (b: LayoutBox) => (axis === 'h' ? b.x : b.y);
  const sorted = [...boxes].sort((a, b) => startOf(a) - startOf(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = startOf(last) + sizeOf(last) - startOf(first);
  const total = sorted.reduce((sum, b) => sum + sizeOf(b), 0);
  const gap = (span - total) / (sorted.length - 1);

  const out: Record<string, { x: number; y: number }> = {};
  let cursor = startOf(first);
  for (const b of sorted) {
    out[b.id] =
      axis === 'h'
        ? { x: Math.round(cursor), y: Math.round(b.y) }
        : { x: Math.round(b.x), y: Math.round(cursor) };
    cursor += sizeOf(b) + gap;
  }
  return out;
}

/**
 * 层级重排：数组顺序即堆叠顺序（越靠后越上层）。
 * 只改顺序，调用方需再用 orderNodesByHierarchy 归一以保证父在子前。
 */
export function reorderLayers<T extends { id: string }>(
  items: readonly T[],
  selected: ReadonlySet<string>,
  op: LayerOp,
): T[] {
  if (selected.size === 0) return [...items];
  const picked = items.filter((i) => selected.has(i.id));
  const rest = items.filter((i) => !selected.has(i.id));

  switch (op) {
    case 'front':
      return [...rest, ...picked];
    case 'back':
      return [...picked, ...rest];
    case 'forward': {
      const result = [...items];
      for (let i = result.length - 2; i >= 0; i -= 1) {
        if (selected.has(result[i].id) && !selected.has(result[i + 1].id)) {
          [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
      }
      return result;
    }
    case 'backward':
    default: {
      const result = [...items];
      for (let i = 1; i < result.length; i += 1) {
        if (selected.has(result[i].id) && !selected.has(result[i - 1].id)) {
          [result[i], result[i - 1]] = [result[i - 1], result[i]];
        }
      }
      return result;
    }
  }
}

/** 边样式归一化：补齐缺失字段并限制线宽范围 */
export function normalizeEdgeStyle(input?: Partial<FlowEdgeStyle> | null): FlowEdgeStyle {
  const d = DEFAULT_EDGE_STYLE;
  if (!input) return { ...d };
  const sw = Number(input.strokeWidth ?? d.strokeWidth);
  return {
    type: input.type ?? d.type,
    stroke: input.stroke ?? d.stroke,
    // 注意：0 是合法的显式输入，会被 clamp 到最小值 1，不能被当成 falsy 走默认值
    strokeWidth: clamp(Number.isFinite(sw) ? sw : d.strokeWidth, 1, 8),
    dash: input.dash ?? d.dash,
    startArrow: input.startArrow ?? d.startArrow,
    endArrow: input.endArrow ?? d.endArrow,
  };
}

/** 线样式 → SVG stroke-dasharray（手绘线型在此给出基础节奏，形变由滤镜负责） */
export function dashArrayOf(dash: FlowEdgeStyle['dash'], width: number): string | undefined {
  switch (dash) {
    case 'dashed':
    case 'sketchDashed':
      return `${width * 3} ${width * 2}`;
    case 'dotted':
      return `${width} ${width}`;
    case 'dashdot':
      return `${width * 4} ${width * 2} ${width} ${width * 2}`;
    case 'solid':
    case 'sketch':
    default:
      return undefined;
  }
}

/** 是否为手绘线型（需要叠加油漆抖动滤镜） */
export function isSketchDash(dash: FlowEdgeStyle['dash'] | undefined): boolean {
  return dash === 'sketch' || dash === 'sketchDashed';
}

/** 节点轮廓线型 → SVG stroke-dasharray */
export function nodeDashArrayOf(
  dash: 'solid' | 'dashed' | 'dotted' | undefined,
  width: number,
): string | undefined {
  switch (dash) {
    case 'dashed':
      return `${width * 3} ${width * 2}`;
    case 'dotted':
      return `${width} ${width}`;
    case 'solid':
    default:
      return undefined;
  }
}

/** 连线路径的描边样式（供自定义边组件 BaseEdge 使用） */
export function edgeStyleOf(style: FlowEdgeStyle): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  filter?: string;
} {
  return {
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: dashArrayOf(style.dash, style.strokeWidth),
    filter: isSketchDash(style.dash) ? 'url(#flow-sketch)' : undefined,
  };
}

/** 自定义连线渲染组件的注册类型（箭头由组件自绘，不受内置 marker 限制） */
export const EDGE_RENDER_TYPE = 'flow';

/**
 * 把连线样式转换为 React Flow 边的渲染属性。
 * 统一使用自定义边组件（type=flow），路径与箭头在组件内按 style 渲染。
 */
export function edgePropsOf(style: FlowEdgeStyle): {
  type: string;
  style: ReturnType<typeof edgeStyleOf>;
} {
  return { type: EDGE_RENDER_TYPE, style: edgeStyleOf(style) };
}
