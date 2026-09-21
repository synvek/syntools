import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { patchSelectedEdgeStyle, selectedEdgeStyle } from '../flowOps';
import { shapeDefOf } from '../model/shapes';
import {
  EDGE_ARROW_LABEL_KEY,
  EDGE_ARROW_OPTIONS,
  EDGE_DASH_OPTIONS,
  EDGE_TYPE_OPTIONS,
  type Align,
  type FlowEdgeStyle,
  type FlowNodePatch,
  isContainerKind,
} from '../model/types';
import { NodeAppearanceSection } from './NodeAppearanceSection';

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

const inputCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

export function PropertyPanel() {
  const { t } = useTranslation();
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

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

  const node = selectedNodes.length > 0 ? nodes.find((n) => n.id === selectedNodes[0]) : undefined;
  const edge =
    selectedNodes.length === 0 && selectedEdges.length === 1
      ? edges.find((e) => e.id === selectedEdges[0])
      : undefined;

  if (edge) {
    const s = selectedEdgeStyle();
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

        <Field label={t('tools.flowchart.label')}>
          <input
            className={inputCls}
            value={typeof edge.label === 'string' ? edge.label : ''}
            placeholder="—"
            onChange={(e) => useFlowStore.getState().patchEdgeLabel(edge.id, e.target.value)}
          />
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
              className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
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
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.noSelection')}
      </div>
    );
  }

  const style = node.data.style;
  const def = shapeDefOf(node.data.kind);
  const aligns: Align[] = ['left', 'center', 'right'];

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.panelTitle')}
      </h2>

      <Field label={t('tools.flowchart.label')}>
        <input
          className={inputCls}
          value={node.data.label}
          onChange={(e) => patch({ label: e.target.value })}
          onBlur={end}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.flowchart.fill')}>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={style.fill}
            onChange={(e) => patch({ style: { fill: e.target.value } })}
            onBlur={end}
          />
        </Field>
        <Field label={t('tools.flowchart.stroke')}>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={style.stroke}
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
            value={style.strokeWidth}
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
            value={style.fontSize}
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
                style.align === a
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
          onClick={() => patch({ style: { bold: !style.bold } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-bold transition-colors ${
            style.bold
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.flowchart.bold')}
        </button>
        <button
          type="button"
          onClick={() => patch({ style: { italic: !style.italic } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] italic transition-colors ${
            style.italic
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.flowchart.italic')}
        </button>
      </div>

      <NodeAppearanceSection style={style} draw={def?.draw} patch={patch} onEnd={end} />
    </div>
  );
}
