import { useTranslation } from 'react-i18next';
import { useFlowStore, type FlowNode } from '../store';
import type { FlowNodeData, TableData } from '../model/types';
import { insertCol, insertRow, normalizeTable, removeCol, removeRow } from '../model/table';

const inputCls =
  'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** 增删行列到目标数量（保持已有内容） */
function resize(
  table: TableData,
  axis: 'rows' | 'cols',
  target: number,
  add: (t: TableData, at: number) => TableData,
  remove: (t: TableData, at: number) => TableData,
): TableData {
  let next = table;
  let current = axis === 'rows' ? next.rows : next.cols;
  while (current < target) {
    next = add(next, current - 1);
    current += 1;
  }
  while (current > target) {
    next = remove(next, current - 1);
    current -= 1;
  }
  return next;
}

/**
 * 表格节点属性分组：行列数量调整（复用 model/table 的纯逻辑，保持已有单元格内容）。
 */
export function NodeTableSection({ node }: { node: FlowNode }) {
  const { t } = useTranslation();
  const table = normalizeTable((node.data as FlowNodeData).table);
  const setTable = (next: TableData) => useFlowStore.getState().setNodeTable(node.id, next, true);

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.tableSection')}
      </h3>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {t('tools.flowchart.tableRows')}
          </span>
          <input
            className={inputCls}
            type="number"
            min={1}
            max={40}
            value={table.rows}
            data-testid="flowchart-table-rows"
            onChange={(e) =>
              setTable(
                resize(
                  table,
                  'rows',
                  Math.max(1, Number(e.target.value) || 1),
                  insertRow,
                  removeRow,
                ),
              )
            }
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {t('tools.flowchart.tableColumns')}
          </span>
          <input
            className={inputCls}
            type="number"
            min={1}
            max={40}
            value={table.cols}
            data-testid="flowchart-table-cols"
            onChange={(e) =>
              setTable(
                resize(
                  table,
                  'cols',
                  Math.max(1, Number(e.target.value) || 1),
                  insertCol,
                  removeCol,
                ),
              )
            }
          />
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.tableHint')}
      </p>
    </div>
  );
}
