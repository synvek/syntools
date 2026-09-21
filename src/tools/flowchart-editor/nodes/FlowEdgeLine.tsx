import type { ReactElement } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import { edgeStyleOf } from '../ops';
import { DEFAULT_EDGE_STYLE, type EdgeArrow, type FlowEdgeStyle } from '../model/types';

const BOX = 10;

/** 箭头形状（在 0..10 的 viewBox 内绘制，颜色取连线描边色） */
function arrowShape(kind: EdgeArrow, color: string): ReactElement | null {
  switch (kind) {
    case 'arrowclosed':
      return <path d="M0,0 L10,5 L0,10 Z" fill={color} />;
    case 'arrow':
      return (
        <path
          d="M0,0 L10,5 L0,10"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case 'circle':
      return <circle cx={5} cy={5} r={4.2} fill={color} />;
    case 'diamond':
      return <path d="M0,5 L5,0 L10,5 L5,10 Z" fill={color} />;
    case 'square':
      return <rect x={0.6} y={0.6} width={8.8} height={8.8} rx={1.2} fill={color} />;
    case 'bar':
      return <path d="M5,0 L5,10" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
    default:
      return null;
  }
}

/** 箭头尖端对齐路径端点：三角类对齐尖端，其它几何形居中对齐 */
function refXOf(kind: EdgeArrow): number {
  return kind === 'arrowclosed' || kind === 'arrow' ? BOX : BOX / 2;
}

function EdgeMarker({ id, kind, color }: { id: string; kind: EdgeArrow; color: string }) {
  return (
    <marker
      id={id}
      viewBox={`0 0 ${BOX} ${BOX}`}
      markerWidth={16}
      markerHeight={16}
      refX={refXOf(kind)}
      refY={BOX / 2}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      {arrowShape(kind, color)}
    </marker>
  );
}

/**
 * 自定义连线：按 style.type 生成路径，并按 startArrow / endArrow 自绘箭头，
 * 因此箭头风格不受 React Flow 内置 marker 限制（实心/空心/圆点/菱形/方块/竖线）。
 */
export function FlowEdgeLine(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label } = props;
  const style: FlowEdgeStyle = {
    ...DEFAULT_EDGE_STYLE,
    ...(props.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style,
  };

  const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  let path: string;
  let labelX: number;
  let labelY: number;
  if (style.type === 'straight') {
    [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  } else if (style.type === 'step') {
    // 直角折线 = 圆角折线（圆角半径 0）
    [path, labelX, labelY] = getSmoothStepPath({ ...params, borderRadius: 0 });
  } else if (style.type === 'smoothstep') {
    [path, labelX, labelY] = getSmoothStepPath(params);
  } else {
    [path, labelX, labelY] = getBezierPath(params);
  }

  const startId = `${id}__start`;
  const endId = `${id}__end`;

  return (
    <>
      <defs>
        {style.startArrow !== 'none' ? (
          <EdgeMarker id={startId} kind={style.startArrow} color={style.stroke} />
        ) : null}
        {style.endArrow !== 'none' ? (
          <EdgeMarker id={endId} kind={style.endArrow} color={style.stroke} />
        ) : null}
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerStart={style.startArrow !== 'none' ? `url(#${startId})` : undefined}
        markerEnd={style.endArrow !== 'none' ? `url(#${endId})` : undefined}
        style={edgeStyleOf(style)}
        interactionWidth={20}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
      />
    </>
  );
}
