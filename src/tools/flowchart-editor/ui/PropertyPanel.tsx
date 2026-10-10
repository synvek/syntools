import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { patchSelectedEdgeStyle, selectedEdgeStyle } from '../flowOps';
import { commonValue } from '../ops';
import { absolutePositionOf } from '../core';
import { hasAdjusts, shapeDefOf, shapeSize } from '../model/shapes';
import {
  EDGE_ARROW_LABEL_KEY,
  EDGE_ARROW_OPTIONS,
  EDGE_DASH_OPTIONS,
  EDGE_JUMP_OPTIONS,
  EDGE_LABEL_POSITION_OPTIONS,
  EDGE_RELATION_PRESETS,
  EDGE_TYPE_OPTIONS,
  type Align,
  type EdgeJumpStyle,
  type FlowEdgeData,
  type FlowEdgeStyle,
  type FlowNodePatch,
  type FlowNodeStyle,
  type FlowNodeStyleView,
  type NodeGeometryPatch,
  isContainerKind,
} from '../model/types';
import { NodeAppearanceSection } from './NodeAppearanceSection';
import { NodeShapeParamsSection } from './NodeShapeParamsSection';
import { NodeTextSection } from './NodeTextSection';
import { NodeTableSection } from './NodeTableSection';
import { NodeTransformSection } from './NodeTransformSection';

const EDGE_TYPES = EDGE_TYPE_OPTIONS;
const DASHES = EDGE_DASH_OPTIONS;
const ARROWS = EDGE_ARROW_OPTIONS;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function MixedBadge({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      {t('tools.flowchart.mixed')}
    </span>
  );
}

/** 连线上已有折点数量（用于回显与按钮禁用） */
function edgeWaypointCount(edge: { data?: unknown }): number {
  const data = edge.data as FlowEdgeData | undefined;
  return data?.waypoints?.length ?? 0;
}

const inputCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

const colorCls =
  'h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900';

export function PropertyPanel() {
  const { t } = useTranslation();
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  /**
   * 连续编辑（拖动滑块 / 输入文字）合并为一次撤销：
   * 会话内第一次改动前 commit，焦点离开后结束会话。
   */
  const session = useRef(false);
  const begin = () => {
    if (!session.current) {
      useFlowStore.getState().commit();
      session.current = true;
    }
  };
  const end = () => {
    session.current = false;
  };
  const patch = (p: FlowNodePatch) => {
    begin();
    useFlowStore.getState().patchSelected(p, false);
  };

  /** 选中节点集合（保持画布上的顺序） */
  const selNodes = nodes.filter((n) => selectedNodes.includes(n.id));
  const edge =
    selectedNodes.length === 0 && selectedEdges.length === 1
      ? edges.find((e) => e.id === selectedEdges[0])
      : undefined;

  if (edge) {
    const s = selectedEdgeStyle();
    const edgeData = edge.data as FlowEdgeData | undefined;
    const connectableNodes = nodes.filter((n) => !isContainerKind(n.data.kind));
    const nodeOptions = connectableNodes.map((n) => (
      <option key={n.id} value={n.id}>
        {/* 图形默认无文案，故无标签时回退为形状名，避免下拉出现空选项 */}
        {n.data.label || t(`tools.flowchart.shape_${n.data.kind}`)} · {n.id.slice(-4)}
      </option>
    ));
    return (
      <div className="flex flex-col gap-3 p-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.edgeStyle')}
        </h2>

        <Field label={t('tools.flowchart.edgeLabel')}>
          <input
            className={inputCls}
            value={typeof edge.label === 'string' ? edge.label : ''}
            placeholder="—"
            data-testid="edge-label-input"
            onChange={(e) => {
              begin();
              useFlowStore.getState().setEdgeLabelField(edge.id, 'label', e.target.value, false);
            }}
            onBlur={end}
          />
        </Field>

        {/* 起止标签与主标签位置：UML 时序/流程语义表达 */}
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.flowchart.edgeSourceLabel')}>
            <input
              className={inputCls}
              value={edgeData?.sourceLabel ?? ''}
              placeholder="—"
              data-testid="edge-source-label-input"
              onChange={(e) => {
                begin();
                useFlowStore
                  .getState()
                  .setEdgeLabelField(edge.id, 'sourceLabel', e.target.value, false);
              }}
              onBlur={end}
            />
          </Field>
          <Field label={t('tools.flowchart.edgeTargetLabel')}>
            <input
              className={inputCls}
              value={edgeData?.targetLabel ?? ''}
              placeholder="—"
              data-testid="edge-target-label-input"
              onChange={(e) => {
                begin();
                useFlowStore
                  .getState()
                  .setEdgeLabelField(edge.id, 'targetLabel', e.target.value, false);
              }}
              onBlur={end}
            />
          </Field>
        </div>

        <Field label={t('tools.flowchart.edgeLabelPosition')}>
          <select
            className={inputCls}
            data-testid="edge-label-position"
            value={edgeData?.labelPosition ?? 'center'}
            onChange={(e) =>
              useFlowStore
                .getState()
                .setEdgeLabelPosition(
                  edge.id,
                  e.target.value as (typeof EDGE_LABEL_POSITION_OPTIONS)[number],
                )
            }
          >
            {EDGE_LABEL_POSITION_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`tools.flowchart.labelPos_${v}`)}
              </option>
            ))}
          </select>
        </Field>

        {/* 重连：直接选择起点/终点节点（与画布上拖拽端点等效） */}
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.flowchart.edgeSourceNode')}>
            <select
              className={inputCls}
              value={edge.source}
              onChange={(e) =>
                useFlowStore.getState().setEdgeEndpoint(edge.id, 'source', e.target.value)
              }
            >
              {nodeOptions}
            </select>
          </Field>
          <Field label={t('tools.flowchart.edgeTargetNode')}>
            <select
              className={inputCls}
              value={edge.target}
              onChange={(e) =>
                useFlowStore.getState().setEdgeEndpoint(edge.id, 'target', e.target.value)
              }
            >
              {nodeOptions}
            </select>
          </Field>
        </div>

        <Field label={t('tools.flowchart.edgeType')}>
          <select
            className={inputCls}
            value={s.type}
            onChange={(e) =>
              patchSelectedEdgeStyle({ type: e.target.value as FlowEdgeStyle['type'] })
            }
          >
            {EDGE_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`tools.flowchart.${v}`)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.flowchart.stroke')}>
            <input
              type="color"
              className={colorCls}
              value={s.stroke}
              onChange={(e) => patchSelectedEdgeStyle({ stroke: e.target.value })}
            />
          </Field>
          <Field label={t('tools.flowchart.strokeWidth')}>
            <input
              type="number"
              min={1}
              max={8}
              className={inputCls}
              value={s.strokeWidth}
              onChange={(e) => patchSelectedEdgeStyle({ strokeWidth: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label={t('tools.flowchart.edgeDash')}>
          <select
            className={inputCls}
            value={s.dash}
            onChange={(e) =>
              patchSelectedEdgeStyle({ dash: e.target.value as FlowEdgeStyle['dash'] })
            }
          >
            {DASHES.map((v) => (
              <option key={v} value={v}>
                {t(`tools.flowchart.${v}`)}
              </option>
            ))}
          </select>
        </Field>

        {/* 折点：正交自动布线 / 清除 */}
        <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-2 dark:border-gray-800">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {t('tools.flowchart.waypoints')}
            {' · '}
            {t('tools.flowchart.waypointCount', { count: edgeWaypointCount(edge) })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="flowchart-auto-route"
              onClick={() => useFlowStore.getState().autoRouteSelectedEdges()}
              className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
            >
              {t('tools.flowchart.autoRoute')}
            </button>
            <button
              type="button"
              data-testid="flowchart-clear-waypoints"
              onClick={() => useFlowStore.getState().setEdgeWaypoints(edge.id, undefined)}
              disabled={edgeWaypointCount(edge) === 0}
              className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
            >
              {t('tools.flowchart.clearWaypoints')}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            {t('tools.flowchart.waypointHint')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.flowchart.edgeStartArrow')}>
            <select
              className={inputCls}
              value={s.startArrow}
              onChange={(e) =>
                patchSelectedEdgeStyle({
                  startArrow: e.target.value as FlowEdgeStyle['startArrow'],
                })
              }
            >
              {ARROWS.map((v) => (
                <option key={v} value={v}>
                  {t(`tools.flowchart.${EDGE_ARROW_LABEL_KEY[v]}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('tools.flowchart.edgeEndArrow')}>
            <select
              className={inputCls}
              value={s.endArrow}
              onChange={(e) =>
                patchSelectedEdgeStyle({ endArrow: e.target.value as FlowEdgeStyle['endArrow'] })
              }
            >
              {ARROWS.map((v) => (
                <option key={v} value={v}>
                  {t(`tools.flowchart.${EDGE_ARROW_LABEL_KEY[v]}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 关系预设：一键切到常见 UML 关系（线型 + 线样式 + 起止箭头） */}
        <Field label={t('tools.flowchart.relationPreset')}>
          <div className="flex flex-wrap gap-1">
            {EDGE_RELATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`edge-relation-${preset.id}`}
                onClick={() => patchSelectedEdgeStyle(preset.patch)}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
              >
                {t(`tools.flowchart.${preset.labelKey}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('tools.flowchart.edgeJump')}>
          <select
            className={inputCls}
            data-testid="edge-jump"
            value={s.jumpStyle ?? 'none'}
            onChange={(e) => patchSelectedEdgeStyle({ jumpStyle: e.target.value as EdgeJumpStyle })}
          >
            {EDGE_JUMP_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`tools.flowchart.jump_${v}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  if (selNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.noSelection')}
      </div>
    );
  }

  const isBatch = selNodes.length > 1;
  const first = selNodes[0];
  const base = first.data.style;

  /** 批次内的公共值：不一致返回 undefined（混合态） */
  const pick = <K extends keyof FlowNodeStyle>(key: K): FlowNodeStyle[K] | undefined =>
    commonValue(selNodes.map((n) => n.data.style[key]));

  const view: FlowNodeStyleView = {
    fill: pick('fill'),
    stroke: pick('stroke'),
    strokeWidth: pick('strokeWidth'),
    fontSize: pick('fontSize'),
    bold: pick('bold'),
    italic: pick('italic'),
    align: pick('align'),
    opacity: pick('opacity'),
    shadow: pick('shadow'),
    lineDash: pick('lineDash'),
    fontFamily: pick('fontFamily'),
    textColor: pick('textColor'),
    cornerRadius: pick('cornerRadius'),
    foldSize: pick('foldSize'),
    rotation: pick('rotation'),
    flipH: pick('flipH'),
    flipV: pick('flipV'),
    verticalAlign: pick('verticalAlign'),
    lineHeight: pick('lineHeight'),
    autoShrink: pick('autoShrink'),
    labelBackground: pick('labelBackground'),
    link: pick('link'),
  };
  const label = commonValue(selNodes.map((n) => n.data.label));
  // 单选时提供该图形专属的可调参数分组（圆角 / 折角 / 斜切 / 分栏高 ……）
  const soleDef = selNodes.length === 1 ? shapeDefOf(first.data.kind) : undefined;
  const aligns: Align[] = ['left', 'center', 'right'];

  /** 各选中节点的几何（画布绝对坐标 + 实际尺寸），用于 X / Y / W / H 输入与混合态判定 */
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const geos = selNodes.map((n) => {
    const abs = absolutePositionOf(n, byId);
    return {
      x: Math.round(abs.x),
      y: Math.round(abs.y),
      width: Math.round(n.width ?? shapeSize(n.data.kind).width),
      height: Math.round(n.height ?? shapeSize(n.data.kind).height),
    };
  });

  /** 几何字段：多选时取公共值，取值不一致则留空并提示「混合」 */
  const geoField = (key: keyof NodeGeometryPatch, label: string) => {
    const value = commonValue(geos.map((g) => g[key]));
    return (
      <Field label={label}>
        <input
          type="number"
          data-testid={`flowchart-geo-${key}`}
          className={inputCls}
          value={value ?? ''}
          placeholder={value === undefined ? t('tools.flowchart.mixed') : undefined}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') return;
            const num = Number(raw);
            if (!Number.isFinite(num)) return;
            begin();
            const patch: NodeGeometryPatch = {};
            patch[key] = num;
            useFlowStore.getState().setNodeGeometry(
              selNodes.map((n) => n.id),
              patch,
              false,
            );
          }}
          onBlur={end}
        />
      </Field>
    );
  };
  // 只有「必然存在」的字段取值不一致才算混合态（可选字段缺省属正常）
  const hasMixed =
    isBatch &&
    (label === undefined ||
      (['fill', 'stroke', 'strokeWidth', 'fontSize', 'bold', 'italic', 'align'] as const).some(
        (k) => view[k] === undefined,
      ));

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-1">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {isBatch
          ? t('tools.flowchart.nodesSelected', { count: selNodes.length })
          : t('tools.flowchart.panelTitle')}
        <MixedBadge show={hasMixed} />
      </h2>

      <Field label={t('tools.flowchart.label')}>
        <input
          data-testid="flowchart-label-input"
          className={inputCls}
          value={label ?? ''}
          placeholder={label === undefined ? t('tools.flowchart.mixed') : undefined}
          onChange={(e) => patch({ label: e.target.value })}
          onBlur={end}
        />
      </Field>

      {/* 公式节点：编辑 LaTeX 源码（仅单选时提供） */}
      {selNodes.length === 1 && first.data.formula !== undefined ? (
        <Field label={t('tools.flowchart.formula')}>
          <textarea
            data-testid="flowchart-formula-input"
            rows={2}
            className="resize-none rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[12px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            value={first.data.formula}
            onChange={(e) => {
              begin();
              useFlowStore.getState().setNodeFormula(first.id, e.target.value, false);
            }}
            onBlur={end}
          />
        </Field>
      ) : null}

      {/* 几何：画布绝对坐标与尺寸（多选取公共值，混合态留空） */}
      <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-2 dark:border-gray-800">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.geometry')}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {geoField('x', t('tools.flowchart.posX'))}
          {geoField('y', t('tools.flowchart.posY'))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {geoField('width', t('tools.flowchart.geoWidth'))}
          {geoField('height', t('tools.flowchart.geoHeight'))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.flowchart.fill')}>
          <input
            type="color"
            className={colorCls}
            value={view.fill ?? base.fill}
            onChange={(e) => patch({ style: { fill: e.target.value } })}
            onBlur={end}
          />
        </Field>
        <Field label={t('tools.flowchart.stroke')}>
          <input
            type="color"
            className={colorCls}
            value={view.stroke ?? base.stroke}
            onChange={(e) => patch({ style: { stroke: e.target.value } })}
            onBlur={end}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.flowchart.strokeWidth')}>
          <input
            type="number"
            min={0}
            max={12}
            className={inputCls}
            value={view.strokeWidth ?? base.strokeWidth}
            onChange={(e) => patch({ style: { strokeWidth: Number(e.target.value) || 0 } })}
            onBlur={end}
          />
        </Field>
        <Field label={t('tools.flowchart.fontSize')}>
          <input
            type="number"
            min={8}
            max={48}
            className={inputCls}
            value={view.fontSize ?? base.fontSize}
            onChange={(e) => patch({ style: { fontSize: Number(e.target.value) || 12 } })}
            onBlur={end}
          />
        </Field>
      </div>

      <Field label={t('tools.flowchart.align')}>
        <div className="flex gap-1">
          {aligns.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => patch({ style: { align: a } })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                view.align === a
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t(
                `tools.flowchart.align${a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}`,
              )}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => patch({ style: { bold: view.bold !== true } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-bold transition-colors ${
            view.bold === true
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.flowchart.bold')}
        </button>
        <button
          type="button"
          onClick={() => patch({ style: { italic: view.italic !== true } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] italic transition-colors ${
            view.italic === true
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.flowchart.italic')}
        </button>
      </div>

      {/* 形状专属可调参数（类 draw.io 调整顶点）：单选时按图形目录声明列出 */}
      {soleDef && hasAdjusts(soleDef) ? (
        <NodeShapeParamsSection
          def={soleDef}
          style={base}
          ids={[first.id]}
          w={geos[0].width}
          h={geos[0].height}
        />
      ) : null}

      <NodeTextSection
        style={view}
        patch={patch}
        onEnd={end}
        fallback={base}
        isContainer={selNodes.some((n) => isContainerKind(n.data.kind))}
      />

      {/* 表格节点专属：行列数量调整 */}
      {selNodes.length === 1 && selNodes[0].type === 'table' ? (
        <NodeTableSection node={selNodes[0]} />
      ) : null}

      <NodeTransformSection style={view} patch={patch} onEnd={end} fallback={base} />

      <NodeAppearanceSection
        style={view}
        patch={patch}
        onEnd={end}
        fallback={base}
        mixed={hasMixed}
      />
    </div>
  );
}
