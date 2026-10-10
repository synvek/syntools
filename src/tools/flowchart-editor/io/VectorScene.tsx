import type { ReactElement } from 'react';
import { absoluteRectOf, anchorOf, stubPoint } from '../core';
import { shapeDefOf } from '../model/shapes';
import { iconDefOf } from '../model/icons';
import { drawDecor, drawShape } from '../nodes/shapeDraw';
import { columnWidths, computeTableLayout, normalizeTable, rowHeights } from '../model/table';
import { normalizeEdgeStyle, polylinePath, type Point } from '../ops';
import { isContainerKind } from '../model/types';
import type { FlowEdgeRec, FlowNodeRec, FlowNodeStyle, FlowPage, ShapeKind } from '../model/types';

/**
 * 自绘矢量导出的场景：把一页数据渲染为纯 SVG（形状为 path、文字为 <text>）。
 * 与画布共用 `drawShape` / `drawDecor` 与图形目录，因此导出结果与屏幕一致；
 * 由于不依赖 DOM 截图，导出结果可缩放、文字可选，也无需切换活动页。
 */

export interface VectorSceneProps {
  page: FlowPage;
  /** 内容外留白 */
  padding: number;
  /** 透明背景（关闭时铺白底） */
  transparent: boolean;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 计算某页内容包围盒（含容器子节点偏移） */
function vectorBoundsOf(page: FlowPage, padding: number): Bounds {
  const byId = new Map(page.nodes.map((n) => [n.id, n] as const));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of page.nodes) {
    if (node.hidden === true) continue;
    const rect = absoluteRectOf(node, byId);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/** 文字换行渲染（多行按 <tspan> 排布） */
function TextLines({
  text,
  x,
  y,
  width,
  height,
  style,
  baseline,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: FlowNodeStyle;
  baseline?: boolean;
}): ReactElement | null {
  if (!text) return null;
  const lines = text.split('\n');
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.25);
  const total = lineHeight * lines.length;
  const firstY = baseline
    ? y + height / 2 - total / 2 + lineHeight / 2
    : y + style.fontSize + (height - total) / 2;
  const anchor = style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start';
  const tx =
    style.align === 'center' ? x + width / 2 : style.align === 'right' ? x + width - 6 : x + 6;

  return (
    <text
      x={tx}
      y={firstY}
      fill={style.textColor ?? style.stroke}
      fontSize={style.fontSize}
      fontWeight={style.bold ? 700 : 400}
      fontStyle={style.italic ? 'italic' : 'normal'}
      fontFamily={style.fontFamily}
      textAnchor={anchor}
      dominantBaseline="middle"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={tx} dy={i === 0 ? 0 : lineHeight}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
}

function ShapeNode({
  node,
  style,
  x,
  y,
  width,
  height,
}: {
  node: FlowNodeRec;
  style: FlowNodeStyle;
  x: number;
  y: number;
  width: number;
  height: number;
}): ReactElement {
  const def = shapeDefOf(node.data.kind);
  return (
    <g
      transform={`translate(${round(x)} ${round(y)})`}
      opacity={style.opacity ?? 1}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    >
      {def ? drawShape(def, width, height, style) : <rect width={width} height={height} rx={4} />}
      {def ? (
        <g
          stroke={style.stroke}
          fill={style.stroke}
          strokeWidth={Math.max(1.5, style.strokeWidth - 0.5)}
        >
          {drawDecor(def, width, height, style)}
        </g>
      ) : null}
      {isContainerKind(node.data.kind) ? (
        <TextLines
          text={node.data.label}
          x={0}
          y={0}
          width={width}
          height={height}
          style={style}
          baseline
        />
      ) : (
        <TextLines text={node.data.label} x={0} y={0} width={width} height={height} style={style} />
      )}
    </g>
  );
}

function TableNode({
  node,
  style,
  x,
  y,
  width,
  height,
}: {
  node: FlowNodeRec;
  style: FlowNodeStyle;
  x: number;
  y: number;
  width: number;
  height: number;
}): ReactElement {
  const table = normalizeTable(node.data.table);
  const boxes = computeTableLayout(table);
  const colW = columnWidths(table, width);
  const rowH = rowHeights(table, height);
  const sum = (sizes: number[], from: number, count: number): number => {
    let total = 0;
    for (let i = from; i < from + count && i < sizes.length; i += 1) total += sizes[i];
    return total;
  };
  const before = (sizes: number[], index: number): number => sum(sizes, 0, index);

  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      {boxes.map((b) => (
        <rect
          key={`${b.row}-${b.col}`}
          x={before(colW, b.col)}
          y={before(rowH, b.row)}
          width={sum(colW, b.col, b.colSpan)}
          height={sum(rowH, b.row, b.rowSpan)}
          fill={b.cell.fill ?? style.fill}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
        />
      ))}
      {boxes
        .filter((b) => b.cell.text)
        .map((b) => (
          <TextLines
            key={`t-${b.row}-${b.col}`}
            text={b.cell.text ?? ''}
            x={before(colW, b.col)}
            y={before(rowH, b.row)}
            width={sum(colW, b.col, b.colSpan)}
            height={sum(rowH, b.row, b.rowSpan)}
            style={{
              ...style,
              bold: b.cell.bold ?? style.bold,
              align: b.cell.align ?? style.align,
            }}
          />
        ))}
    </g>
  );
}

const ARROW_MARKER: Record<string, string> = {
  arrowclosed: 'vecArrowClosed',
  arrow: 'vecArrow',
  circle: 'vecCircle',
  diamond: 'vecDiamond',
  diamondHollow: 'vecDiamondHollow',
  triangle: 'vecTriangle',
  square: 'vecSquare',
  bar: 'vecBar',
};

/** 端点锚点 → 单位外推方向（用于直线端点与箭头走向） */
function edgePointsOf(
  edge: FlowEdgeRec,
  byId: Map<string, FlowNodeRec>,
): { points: Point[]; kind: ShapeKind } | null {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const from = anchorOf(source, byId, edge.sourceHandle, target);
  const to = anchorOf(target, byId, edge.targetHandle, source);
  const fromStub = stubPoint(from.point, from.side);
  const toStub = stubPoint(to.point, to.side);
  const mid = edge.waypoints?.map((p) => ({ x: p.x, y: p.y })) ?? [];
  const points = [fromStub, ...mid, toStub];
  return { points, kind: source.data.kind };
}

function EdgeScene({
  edge,
  byId,
}: {
  edge: FlowEdgeRec;
  byId: Map<string, FlowNodeRec>;
}): ReactElement | null {
  const geometry = edgePointsOf(edge, byId);
  if (!geometry) return null;
  const style = normalizeEdgeStyle(edge.style);
  const d = polylinePath(geometry.points, style.type === 'smoothstep' ? 10 : 0);
  const markerEnd = style.endArrow === 'none' ? undefined : `url(#${ARROW_MARKER[style.endArrow]})`;
  const markerStart =
    style.startArrow === 'none' ? undefined : `url(#${ARROW_MARKER[style.startArrow]})`;
  const dash =
    style.dash === 'dashed' || style.dash === 'sketchDashed'
      ? '6 4'
      : style.dash === 'dotted'
        ? '2 3'
        : style.dash === 'dashdot'
          ? '8 4 2 4'
          : undefined;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={dash}
        markerEnd={markerEnd}
        markerStart={markerStart}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {edge.label ? (
        <TextLines
          text={edge.label}
          x={polylineMid(geometry.points).x - 40}
          y={polylineMid(geometry.points).y - 18}
          width={80}
          height={18}
          style={{
            fill: 'transparent',
            stroke: style.stroke,
            strokeWidth: 0,
            fontSize: 12,
            bold: false,
            italic: false,
            align: 'center',
            textColor: style.stroke,
          }}
        />
      ) : null}
    </g>
  );
}

function polylineMid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const mid = Math.max(0, Math.floor((points.length - 1) / 2));
  const a = points[mid];
  const b = points[mid + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** 纯 SVG 场景（供 renderToStaticMarkup 序列化） */
export function VectorScene({ page, padding, transparent }: VectorSceneProps): ReactElement {
  const bounds = vectorBoundsOf(page, padding);
  const byId = new Map(page.nodes.map((n) => [n.id, n] as const));
  const visible = page.nodes.filter((n) => n.hidden !== true);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={round(bounds.width)}
      height={round(bounds.height)}
      viewBox={`${round(bounds.x)} ${round(bounds.y)} ${round(bounds.width)} ${round(bounds.height)}`}
    >
      <defs>
        <marker
          id="vecArrowClosed"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
        </marker>
        <marker id="vecArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10" fill="none" stroke="context-stroke" strokeWidth={1.6} />
        </marker>
        <marker id="vecCircle" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
          <circle cx={5} cy={5} r={4} fill="context-stroke" />
        </marker>
        <marker id="vecDiamond" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
          <path d="M0,6 L6,0 L12,6 L6,12 Z" fill="context-stroke" />
        </marker>
        <marker
          id="vecDiamondHollow"
          markerWidth="12"
          markerHeight="12"
          refX="11"
          refY="6"
          orient="auto"
        >
          <path d="M0,6 L6,0 L12,6 L6,12 Z" fill="none" stroke="context-stroke" strokeWidth={1.4} />
        </marker>
        <marker
          id="vecTriangle"
          markerWidth="12"
          markerHeight="12"
          refX="11"
          refY="6"
          orient="auto"
        >
          <path d="M0,0 L12,6 L0,12 Z" fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
        </marker>
        <marker id="vecSquare" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
          <rect x={1} y={1} width={8} height={8} fill="context-stroke" />
        </marker>
        <marker id="vecBar" markerWidth="8" markerHeight="10" refX="4" refY="5" orient="auto">
          <path d="M4,0 L4,10" stroke="context-stroke" strokeWidth={2} />
        </marker>
      </defs>

      {transparent ? null : (
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="#ffffff"
        />
      )}

      {visible
        .filter((n) => n.type === 'shape')
        .map((n) => {
          const rect = absoluteRectOf(n, byId);
          return (
            <ShapeNode
              key={n.id}
              node={n}
              style={n.data.style}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
            />
          );
        })}

      {visible
        .filter((n) => n.type === 'icon')
        .map((n) => {
          const rect = absoluteRectOf(n, byId);
          const def = iconDefOf(n.data.iconId);
          return (
            <g
              key={n.id}
              transform={`translate(${round(rect.x)} ${round(rect.y)}) scale(${rect.width / 24} ${rect.height / 24})`}
            >
              {def ? (
                <g
                  fill="none"
                  stroke={n.data.style.textColor ?? n.data.style.stroke}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {def.paths.map((p, i) => (
                    <path key={i} d={p} />
                  ))}
                </g>
              ) : null}
            </g>
          );
        })}

      {visible
        .filter((n) => n.type === 'image' && n.data.src)
        .map((n) => {
          const rect = absoluteRectOf(n, byId);
          return (
            <image
              key={n.id}
              href={n.data.src}
              x={round(rect.x)}
              y={round(rect.y)}
              width={round(rect.width)}
              height={round(rect.height)}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        })}

      {visible
        .filter((n) => n.type === 'table')
        .map((n) => {
          const rect = absoluteRectOf(n, byId);
          return (
            <TableNode
              key={n.id}
              node={n}
              style={n.data.style}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
            />
          );
        })}

      {page.edges.map((e) => (
        <EdgeScene key={e.id} edge={e} byId={byId} />
      ))}
    </svg>
  );
}
