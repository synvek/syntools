import type { RefObject } from 'react';
import type { RibbonBaseContext } from '../SpreadsheetRibbon';
import { buildSheetMenu, type SheetActions, type SheetCommandContext } from '../commands';
import type { WorkbookSummary } from '../core';
import { reportSheetIssue } from '../issues';
import { parseClipboardMatrix, type SheetFormatState } from '../sheetFormat';
import { auditFormulas, type FunctionAudit } from '../sheetFunctions';
import type { SortColumn } from '../sorting';
import type { UniverHandle } from '../univer';

/**
 * 命令表面（P2-4）：把 `commands.ts` 那张命令表**接上**真实动作与真实事实。
 *
 * 这一段之前在组件里是两个大字面量（`sheetActions` 90 行 + `ribbonBase` 15 行）外加两行胶水。
 * 它该被搬走的理由不是行数，而是这三条：
 *
 * - **没有 JSX**，纯粹是"事件 → 一次引擎调用 / 一次对话框开合"；
 * - **依赖是平铺的一串能力**，可以用接口写清楚，不再靠闭包偷偷读组件作用域；
 * - **现状零单测**——90 行里全是"点了会怎样"的规则（取消 prompt 不该改表名、排序拿不到选区就别弹窗、
 *   剪贴板不可用要报 `clipboardRead`……），搬出来才能逐个锁住。
 *
 * 刻意只收"事实"（`busy` / `summary` / `protectedSheet`），而且以**值**传入：命令的 `disabled`
 * 谓词必须与用户此刻看到的一致，读 ref 会拿到上一帧的。
 *
 * 对话框的开合状态仍留在组件（对话框自己还要能关），这里只决定"哪个命令开哪个框、开之前快照什么"。
 */
export interface SheetCommandSurfaceDeps {
  t: RibbonBaseContext['t'];

  /* ---------------------------------- 引擎 ---------------------------------- */
  /** 命令里一半动作只是"事件 → 一次引擎调用" */
  handleRef: RefObject<UniverHandle | null>;
  /** 同一个句柄，但以值传入：命令表的 `disabled` 谓词要问"现在有没有实例" */
  host: UniverHandle | null;
  /** `insertImage` 走的是隐藏 file input，不点它就出不来系统面板 */
  imageInputRef: RefObject<HTMLInputElement | null>;

  /* -------------------------------- 文档级动作 -------------------------------- */
  newDoc: () => void;
  clear: () => void;
  openImport: (accept: string) => void;
  exportXlsx: () => Promise<void>;
  exportCsv: () => void;
  openPrint: () => void;
  openLibrary: () => void;
  openVersions: () => void;
  openPresent: () => void;

  /* ------------------------------- 对象 / 元数据 ------------------------------ */
  insertChart: () => void;
  insertShape: () => void;
  insertPivot: () => void;
  openNames: () => void;
  insertTable: () => void;
  deleteTable: () => void;
  openComments: () => void;
  openProtect: () => void;

  /* --------------------------------- 标签栏 --------------------------------- */
  addSheet: () => void;
  duplicateSheet: (id: string) => void;
  renameSheet: (id: string, name: string) => void;
  deleteSheet: (id: string) => void;
  /** 当前表；为 null 时"复制 / 重命名 / 删除"一律无动作（不是报错） */
  activeSheet: { id: string; name: string } | null;

  /* --------------------------------- 对话框 --------------------------------- */
  /** 开数字格式框前先快照当前格的格式码，否则框里显示的是上一次的值 */
  showNumberFormat: (initial: string) => void;
  /** 开"设置单元格格式"前快照格式：对话框必须描述它即将改动的东西 */
  showFormatCells: (format: SheetFormatState | null) => void;
  showShortcuts: () => void;
  showFormulaReport: (report: FunctionAudit) => void;
  showSort: (columns: SortColumn[], hasHeader: boolean) => void;

  /* ------------------------------ ribbonBase 事实 ----------------------------- */
  busy: boolean;
  summary: WorkbookSummary;
  sheetCount: number;
  /** 受保护的表：编辑类命令一律禁用，但导出仍可点 */
  protectedSheet: boolean;
  hasTable: boolean;
  docId: string | null;
  title: string;
  /** 只有形状 / 图表的工作簿仍然可导出：导出写的是原生 `xdr:*` 部件 */
  hasFloatingObjects: boolean;
}

export interface SheetCommandSurface {
  sheetActions: SheetActions;
  ribbonBase: RibbonBaseContext;
  /** ⋯ 菜单只带 Ribbon 上没有按钮的命令，与 Ribbon 同源同判定 */
  menu: ReturnType<typeof buildSheetMenu>;
  /** 键盘层要的完整上下文（含 host），调用方塞进 ref 以保持监听器稳定 */
  commandCtx: SheetCommandContext;
}

export function useSheetCommandSurface(deps: SheetCommandSurfaceDeps): SheetCommandSurface {
  const { t, handleRef, host, imageInputRef, activeSheet } = deps;

  const sheetActions: SheetActions = {
    newDoc: deps.newDoc,
    // 同一个入口也收 .ods：分流在 `checkImportFile`，用户不必先记住自己手里是哪种容器
    importXlsx: () => deps.openImport('.xlsx,.xlsm,.ods'),
    importCsv: () => deps.openImport('.csv'),
    exportXlsx: () => void deps.exportXlsx(),
    exportCsv: deps.exportCsv,
    print: deps.openPrint,
    library: deps.openLibrary,
    versions: deps.openVersions,
    clear: deps.clear,
    undo: () => handleRef.current?.undo(),
    redo: () => handleRef.current?.redo(),
    insertChart: deps.insertChart,
    insertShape: deps.insertShape,
    insertImage: () => imageInputRef.current?.click(),
    insertPivot: deps.insertPivot,
    openNames: deps.openNames,
    insertTable: deps.insertTable,
    deleteTable: deps.deleteTable,
    addSheet: deps.addSheet,
    duplicateSheet: () => {
      if (activeSheet) deps.duplicateSheet(activeSheet.id);
    },
    renameSheet: () => {
      if (!activeSheet) return;
      const name = window.prompt(t('tools.sheet.rename'), activeSheet.name);
      // `prompt` 取消返回 null；空串 / 只改空格 / 名字没变，都不该产生一次重命名
      if (name === null) return;
      const next = name.trim();
      if (!next || next === activeSheet.name) return;
      deps.renameSheet(activeSheet.id, next);
    },
    deleteSheet: () => {
      if (activeSheet) deps.deleteSheet(activeSheet.id);
    },
    openComments: deps.openComments,
    openProtect: deps.openProtect,
    // 命令表也走同一套投影：只置位不建网格会让第二次演示停留在上一份内容
    present: deps.openPresent,
    promptHyperlink: () => {
      const url = window.prompt(t('tools.sheet.r.hyperlinkPrompt'), 'https://');
      if (url === null) return;
      handleRef.current?.setHyperlink(url.trim());
    },
    openNumberFormat: () => {
      deps.showNumberFormat(handleRef.current?.getFormatState()?.numberFormat ?? '');
    },
    openFormatCells: () => {
      deps.showFormatCells(handleRef.current?.getFormatState() ?? null);
    },
    openShortcuts: deps.showShortcuts,
    checkFormulas: () => {
      deps.showFormulaReport(auditFormulas(host?.readSelectionFormulas() ?? []));
    },
    openSort: () => {
      // 对话框对列的描述必须针对"它即将重排的那一块"，拿不到就别弹
      const info = host?.describeSortRange();
      if (!info) return;
      deps.showSort(info.columns, info.hasHeader);
    },
    copyToClipboard: (text) => {
      const clipboard = navigator.clipboard;
      if (!clipboard) {
        // 不可用与"写了但失败"必须区分开：一个要提示用户手动复制，一个是环境/权限问题
        reportSheetIssue({ code: 'clipboardWrite', level: 'notice' });
        return;
      }
      void clipboard.writeText(text).catch((error: unknown) => {
        reportSheetIssue({ code: 'clipboardWrite', level: 'notice', detail: String(error) });
      });
    },
    pasteFromClipboard: () => {
      const clipboard = navigator.clipboard;
      if (!clipboard) {
        reportSheetIssue({ code: 'clipboardRead', level: 'notice' });
        return;
      }
      void clipboard
        .readText()
        .then((text) => {
          // 纯空白粘贴会把选区清空，用户看到的是"什么都没发生但内容没了"
          if (!text.trim()) return;
          handleRef.current?.writeMatrix(parseClipboardMatrix(text));
        })
        .catch((error: unknown) => {
          reportSheetIssue({ code: 'clipboardRead', level: 'notice', detail: String(error) });
        });
    },
  };

  const ribbonBase: RibbonBaseContext = {
    t,
    actions: sheetActions,
    busy: deps.busy,
    cellCount: deps.summary.cells,
    canExportXlsx: deps.summary.cells > 0 || deps.hasFloatingObjects,
    sheetCount: deps.sheetCount,
    hasActiveSheet: Boolean(activeSheet),
    activeSheetName: activeSheet?.name ?? null,
    protectedSheet: deps.protectedSheet,
    hasTable: deps.hasTable,
    hasDocId: Boolean(deps.docId),
    hasTitle: Boolean(deps.title.trim()),
  };

  const commandCtx: SheetCommandContext = { ...ribbonBase, host, format: null };

  return { sheetActions, ribbonBase, menu: buildSheetMenu(commandCtx), commandCtx };
}
