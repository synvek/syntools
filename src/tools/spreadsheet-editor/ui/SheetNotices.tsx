import { useTranslation } from 'react-i18next';
import { translateToolError } from '@/core/i18n/helpers';
import type { ToolResult } from '@/core/types';
import { chartTypeBreakdown, type ChartImportReport } from '../chartImport';
import { CHART_TYPE_LABEL_KEY } from '../charts';
import type { DocStoreStatus } from '../docStore';
import type { SheetIssue } from '../issues';
import { StorageNotice } from '../DocLibraryPanel';

/**
 * 表格工具的行内提示区（P2-4 第十四片）。
 *
 * 这里收的都是"**必须说一句、但不该打断操作**"的话：图表选区为空、图片超限读坏、导入时保留了
 * 多少原生图表、运行时崩了、文档库不可用、草稿降级、某次点击为什么没反应、以及最后一次失败。
 *
 * 三条规则写进组件，而不是散在九处 `{x ? <p/> : null}`：
 *
 * 1. **等级决定语气**：`error`（红）表示"你这次要的事没发生"，`notice`（琥珀）表示"降级但文档还在"。
 *    两者都走 `role="status"` 而不是 `alert`——后者会把读屏的当前朗读打断，而这几种提示都不是紧急事故。
 * 2. **同一句话不重复**：`reportSheetIssue` 已经在会话内按 code 去重（P0-3），这里只负责渲染。
 * 3. **文案全部走 i18n**：`draftNotice` 只有 'degraded' / 'failed' 两个状态，映射写在组件里，
 *    调用方不必知道"哪句中文对应哪个状态"。
 *
 * 纯展示：所有状态都由调用方持有，这里不 setState、不订阅。
 */
export interface SheetNoticesProps {
  /** 选区里没有可画的数据（图表命令被点了但画不出来） */
  chartEmpty: boolean;
  /** 表格 / 图片的临时提示（成败都可能是这里，文案已翻译） */
  tableNotice: string | null;
  imageNotice: string | null;
  /** 导入保真：可编辑 / 原样保留的原生图表数量 */
  chartImport: ChartImportReport | null;
  /** 引擎初始化失败：整个编辑器不可用 */
  runtimeError: boolean;
  storeStatus: DocStoreStatus;
  onRetryStore: () => void;
  onFreeSpace: () => void;
  /** 草稿落盘降级：'degraded' = 换到 IndexedDB，'failed' = 彻底没存上 */
  draftNotice: 'degraded' | 'failed' | null;
  /** P0-3：一次点击失败的原因，会话内同一 code 只报一次 */
  issueNotice: SheetIssue | null;
  failure: Extract<ToolResult<unknown>, { ok: false }> | null;
}

export function SheetNotices(props: SheetNoticesProps) {
  const { t } = useTranslation();
  const { chartImport, draftNotice, issueNotice, failure } = props;

  return (
    <>
      {props.chartEmpty ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {t('tools.sheet.chartEmpty')}
        </p>
      ) : null}

      {props.tableNotice ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {props.tableNotice}
        </p>
      ) : null}

      {props.imageNotice ? (
        <p role="status" className="px-4 pb-1 text-[12px] text-amber-700 dark:text-amber-400">
          {props.imageNotice}
        </p>
      ) : null}

      {/* 导入报告：可编辑的图表数 + 类型明细 + 原样保留的数量，一行说完 */}
      {chartImport ? (
        <p role="status" className="text-[11px] text-gray-500 dark:text-gray-400">
          {chartImport.editable.total > 0
            ? `${t('tools.sheet.chartImported', { count: chartImport.editable.total })}${
                chartTypeBreakdown(chartImport.editable).length > 0
                  ? ` · ${chartTypeBreakdown(chartImport.editable)
                      .map(
                        (item) =>
                          `${t(`tools.sheet.${CHART_TYPE_LABEL_KEY[item.type]}`)} ${item.count}`,
                      )
                      .join(' / ')}`
                  : ''
              }`
            : ''}
          {chartImport.editable.total > 0 && chartImport.kept.total > 0 ? ' · ' : ''}
          {chartImport.kept.total > 0
            ? t('tools.sheet.chartKept', { count: chartImport.kept.total })
            : ''}
        </p>
      ) : null}

      {props.runtimeError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      )}

      {/* P2-3: 文档库不可用 / 空间不足——说清原因，并能就地重试；空间不足还能去删旧版本 */}
      <StorageNotice
        status={props.storeStatus}
        onRetry={props.onRetryStore}
        onFreeSpace={props.onFreeSpace}
      />

      {draftNotice && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {draftNotice === 'degraded'
            ? t('tools.sheet.draftDegraded')
            : t('tools.sheet.draftSaveFailed')}
        </p>
      )}

      {/* P0-3: a click that did nothing now says why, once, then gets out of the way */}
      {issueNotice && (
        <p
          role="status"
          data-testid="sheet-issue-notice"
          className={
            issueNotice.level === 'error'
              ? 'text-sm text-red-600 dark:text-red-400'
              : 'text-sm text-amber-700 dark:text-amber-400'
          }
        >
          {t(`tools.sheet.issue.${issueNotice.code}`)}
        </p>
      )}

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', failure)}
        </p>
      )}
    </>
  );
}
