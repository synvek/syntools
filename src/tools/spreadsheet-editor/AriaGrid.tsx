import { useTranslation } from 'react-i18next';
import { ARIA_GRID_DOM_ID, type AriaGridModel } from './a11yGrid';

/**
 * 视觉隐藏的 `role="grid"`（P2-9）：把画布上"用户此刻在哪、这一格是什么"交给读屏软件。
 *
 * 用 `clip` 而不是 `display:none` / `visibility:hidden`：后两者会把节点从无障碍树里摘掉，
 * 那就是这个组件存在的反面。`pointer-events-none` 保证它不吃鼠标事件（画布才是交互层）。
 *
 * 单元格文案是"第 3 行 第 2 列，销售额"，行/列号从 1 开始——与 Excel 的说法一致，
 * 也让读屏能定位；空单元格读"空白"，而不是读一个空字符串。
 */
export function AriaGrid({ model }: { model: AriaGridModel }) {
  const { t } = useTranslation();
  if (model.rowCount === 0) return null;

  return (
    <div
      id={ARIA_GRID_DOM_ID}
      role="grid"
      aria-label={t('tools.sheet.a11yGridLabel')}
      aria-rowcount={model.rowCount}
      aria-colcount={model.columnCount}
      aria-activedescendant={model.activeId ?? undefined}
      className="pointer-events-none absolute h-px w-px overflow-hidden"
      style={{ clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}
      data-testid="sheet-a11y-grid"
      data-truncated={model.truncated ? 'true' : undefined}
    >
      {model.rows.map((cells) => (
        <div role="row" key={cells[0].id} aria-rowindex={cells[0].row + 1}>
          {cells.map((cell) => (
            <div
              role="gridcell"
              key={cell.id}
              id={cell.id}
              aria-colindex={cell.column + 1}
              aria-selected={cell.active}
              aria-label={t('tools.sheet.a11yGridCell', {
                row: cell.row + 1,
                column: cell.column + 1,
                value: cell.text || t('tools.sheet.a11yGridBlank'),
              })}
            >
              {cell.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
