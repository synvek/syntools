import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { adjustsFor, paramValue, type ShapeDef } from '../model/shapes';
import type { FlowNodeStyle } from '../model/types';

const numberCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/**
 * 形状可调参数分组（属性面板）：按图形目录声明逐项渲染滑块 + 数值输入 + 重置。
 * 与画布上的黄色调整顶点共用同一份声明与解析器，取值天然一致。
 */
export function NodeShapeParamsSection({
  def,
  style,
  ids,
  w,
  h,
}: {
  def: ShapeDef;
  style: FlowNodeStyle;
  /** 目标节点 id（通常为单个选中节点） */
  ids: string[];
  w: number;
  h: number;
}) {
  const { t } = useTranslation();
  const adjusts = adjustsFor(def);
  /** 连续编辑（拖动滑块 / 输入）合并为一次撤销 */
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
  const patch = (key: string, value: number) => {
    begin();
    useFlowStore.getState().setNodeParams(ids, { [key]: value }, false);
  };
  const reset = (key: string) => useFlowStore.getState().clearNodeParam(ids, key);

  if (adjusts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-2 dark:border-gray-800">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.shapeParams')}
      </span>
      {adjusts.map((adj) => {
        const value = paramValue(def, style, adj.key, w, h);
        const min = adj.min(w, h);
        const max = adj.max(w, h);
        const step = adj.unit === 'ratio' ? 0.01 : 1;
        const label = t(`tools.flowchart.shapeParam.${adj.labelKey}`);
        const display =
          adj.unit === 'ratio' ? `${Math.round(value * 100)}%` : `${Math.round(value)}px`;
        return (
          <div key={adj.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] text-gray-500 dark:text-gray-400">
              {label}
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              aria-label={label}
              data-testid={`flowchart-param-${adj.key}`}
              onChange={(e) => patch(adj.key, Number(e.target.value))}
              onBlur={end}
              onPointerUp={end}
              className="min-w-0 flex-1 accent-blue-500"
            />
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={adj.unit === 'ratio' ? Math.round(value * 100) : Math.round(value)}
              aria-label={`${label} (${display})`}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                patch(adj.key, adj.unit === 'ratio' ? n / 100 : n);
              }}
              onBlur={end}
              className={`${numberCls} w-16 shrink-0`}
            />
            <button
              type="button"
              aria-label={`${t('tools.flowchart.reset')} ${label}`}
              title={t('tools.flowchart.reset')}
              onClick={() => reset(adj.key)}
              className="shrink-0 rounded-md border border-gray-200 px-1.5 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              ↺
            </button>
          </div>
        );
      })}
      <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.shapeParamHint')}
      </p>
    </div>
  );
}
