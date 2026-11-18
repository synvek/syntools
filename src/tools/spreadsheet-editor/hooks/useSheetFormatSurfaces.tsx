import { useState, type ReactNode } from 'react';
import type { RibbonBaseContext } from '../SpreadsheetRibbon';
import { commitFromDraft } from '../formatCells';
import { SUPPORTED_FUNCTION_COUNT, type FunctionAudit } from '../sheetFunctions';
import type { SheetFormatState } from '../sheetFormat';
import type { SortColumn } from '../sorting';
import type { UniverHandle } from '../univer';
import { FormatCellsDialog } from '../ui/FormatCellsDialog';
import { NumberFormatDialog } from '../ui/NumberFormatDialog';
import { SortDialog } from '../ui/SortDialog';

/**
 * 格式类浮层（P2-4 第十三片）：数字格式 / 排序 / 设置单元格格式 / 公式审计。
 *
 * 这四个东西的共同点是"**开关状态只为它们自己存在**"：`numberFormatInitial` 只用来回填一个输入框，
 * `sortColumns` 只描述一次即将发生的重排，`formulaReport` 只是一句结论。放在编排层里，
 * 它们占了 8 个 state 与 70 行 JSX，却和编排逻辑没有任何耦合。
 *
 * 于是这里用了一个在别处会显得奇怪的形状：**hook 返回 JSX**。正当性来自"状态与它的消费者必须住在一起"——
 * 谁启动了这个浮层、谁就该负责把它画出来，编排层只留一行 `{formatSurfaces}`。
 * 副作用是这些浮层不再能被单独记忆（每个 render 都重建），但这四个都是"打开才存在"的轻组件，
 * 重建成不成立本；相比之下，把 8 个 state 散落在 1,600 行文件里才是真的成本。
 *
 * 依赖刻意只有两样：翻译函数与引擎句柄。**不给**整个命令上下文——那样又会把这层粘回编排层。
 */
export interface SheetFormatSurfacesDeps {
  t: RibbonBaseContext['t'];
  host: UniverHandle | null;
}

export interface SheetFormatSurfaces {
  /** 挂进渲染树的一行 */
  surfaces: ReactNode;
  /** 开数字格式框前先快照当前格式码，否则框里显示的是上一次的值 */
  showNumberFormat: (initial: string) => void;
  /** 开"设置单元格格式"前快照格式：对话框必须描述它即将改动的东西 */
  showFormatCells: (format: SheetFormatState | null) => void;
  showSort: (columns: SortColumn[], hasHeader: boolean) => void;
  showFormulaReport: (report: FunctionAudit) => void;
}

export function useSheetFormatSurfaces(deps: SheetFormatSurfacesDeps): SheetFormatSurfaces {
  const { t, host } = deps;

  const [numberFormatOpen, setNumberFormatOpen] = useState(false);
  const [numberFormatInitial, setNumberFormatInitial] = useState('');
  const [formatCellsOpen, setFormatCellsOpen] = useState(false);
  const [formatCellsFormat, setFormatCellsFormat] = useState<SheetFormatState | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [sortHasHeader, setSortHasHeader] = useState(false);
  const [formulaReport, setFormulaReport] = useState<FunctionAudit | null>(null);

  const surfaces = (
    <>
      <NumberFormatDialog
        open={numberFormatOpen}
        initial={numberFormatInitial}
        onClose={() => setNumberFormatOpen(false)}
        onApply={(pattern) => {
          host?.applyNumberFormat(pattern);
          setNumberFormatOpen(false);
        }}
      />
      {/*
       * Formula audit result (P1-10). A short inline card instead of a dialog: the answer is one
       * sentence and the user should stay in the grid.
       */}
      {formulaReport ? (
        <div
          role="status"
          data-testid="sheet-formula-audit"
          className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200"
        >
          <span>
            {formulaReport.formulas === 0
              ? t('tools.sheet.formulaAuditNone')
              : formulaReport.unsupported.length === 0
                ? t('tools.sheet.formulaAuditOk', {
                    count: formulaReport.formulas,
                    total: SUPPORTED_FUNCTION_COUNT,
                  })
                : t('tools.sheet.formulaAuditMissing', {
                    names: formulaReport.unsupported.join(', '),
                  })}
          </span>
          <button
            type="button"
            onClick={() => setFormulaReport(null)}
            aria-label={t('tools.sheet.printCancel')}
            className="text-green-700 hover:text-green-900 dark:text-green-300"
          >
            ×
          </button>
        </div>
      ) : null}
      <SortDialog
        open={sortOpen}
        columns={sortColumns}
        hasHeader={sortHasHeader}
        onClose={() => setSortOpen(false)}
        onApply={(keys, hasHeader) => {
          host?.sortRange(keys, hasHeader);
          setSortOpen(false);
        }}
      />
      <FormatCellsDialog
        open={formatCellsOpen}
        format={formatCellsFormat}
        onClose={() => setFormatCellsOpen(false)}
        onApply={(draft) => {
          // 一次提交里"格式"与"边框"是两条不同的引擎调用，顺序不能反：
          // 边框预设会覆盖区域内的样式，先刷格式再刷边框才是用户看到的样子
          const commit = commitFromDraft(draft);
          host?.applyFormat(commit.patch);
          if (commit.border) host?.applyBorder(commit.border.preset, commit.border.spec);
          setFormatCellsOpen(false);
        }}
      />
    </>
  );

  return {
    surfaces,
    showNumberFormat: (initial) => {
      setNumberFormatInitial(initial);
      setNumberFormatOpen(true);
    },
    showFormatCells: (format) => {
      setFormatCellsFormat(format);
      setFormatCellsOpen(true);
    },
    showSort: (columns, hasHeader) => {
      setSortColumns(columns);
      setSortHasHeader(hasHeader);
      setSortOpen(true);
    },
    showFormulaReport: setFormulaReport,
  };
}
