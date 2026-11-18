import { useTranslation } from 'react-i18next';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import { SheetTabs } from '../SheetTabs';
import type { RibbonBaseContext } from '../SpreadsheetRibbon';
import type { UniverHandle } from '../univer';
import { CellEditSheet } from './CellEditSheet';
import { SheetMobileBar } from './SheetMobileBar';

/**
 * 工作簿下方的一切（P2-4 第十六片）：读屏播报槽 → 标签栏 → 状态栏 → 移动端工具条 → 改值浮层。
 *
 * 这四件东西在布局上是"从上到下的固定顺序"，在语义上却分属三件事：**导航**（标签栏）、
 * **事实**（状态栏里的格子数 / 内存）、**移动端专属入口**（工具条 + 浮层）。混在编排层里时，
 * 它们的顺序只能靠读代码确认；抽出来之后顺序就是组件体里的顺序，改一次只改一处。
 *
 * 两个刻意的决定：
 *
 * 1. **读屏播报槽放在最前面**（`sr-only` + `aria-live="polite"`），而不是跟着状态栏走：
 *    它在 DOM 里的位置与朗读顺序无关，但放在这块的顶部能让"这块负责播报"一眼可见。
 * 2. **移动端相关的东西全在这个文件里**：`narrow` 一旦为 true，工具条与改值浮层同时出现；
 *    如果它们分散在编排层两处，将来加第三个移动端入口时又会忘掉一个条件。
 */
type SheetTabsProps = Parameters<typeof SheetTabs>[0];

export interface SheetFooterProps {
  /** 选区变化时写进 live region 的那句话 */
  a11yStatus: string;
  /** 标签栏的整套 props 原样透传：它的动作都由 hook 提供，这一层不做判断 */
  tabs: SheetTabsProps;
  stats: { label: string; value: number }[];
  /** 有批注时才出现在状态栏左侧 */
  commentCount: number;
  /** 已格式化的内存占用 */
  memory: string;
  narrow: boolean;
  /** 底部工具条要完整命令上下文（命令与禁用规则都来自命令表） */
  mobileCtx: RibbonBaseContext;
  mobileHost: UniverHandle | null;
  onEditCell: () => void;
  cellEdit: { address: string; value: string } | null;
  onCancelCellEdit: () => void;
  onSubmitCellEdit: (next: string) => void;
}

export function SheetFooter(props: SheetFooterProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Selection announcement for screen readers (P0-6): visual users get the highlight, readers get this */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="sheet-a11y-status">
        {props.a11yStatus}
      </p>

      <SheetTabs {...props.tabs} />

      <EditorStatusBar
        left={
          <>
            {props.stats.map((item) => (
              <span key={item.label}>
                {item.label}: {item.value}
              </span>
            ))}
            {props.commentCount > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                {t('tools.sheet.commentCount', { count: props.commentCount })}
              </span>
            ) : null}
          </>
        }
        right={<span>{t('common.memoryUsage', { size: props.memory })}</span>}
      />

      {/* 窄屏底部工具条（P2-8）：6 个一次性动作，命令与禁用规则都来自同一张命令表 */}
      {props.narrow ? (
        <SheetMobileBar
          ctx={props.mobileCtx}
          host={props.mobileHost}
          onEditCell={props.onEditCell}
        />
      ) : null}
      {/* 改值浮层：只在窄屏出现；宽屏有引擎自带的单元格编辑器与公式栏 */}
      {props.narrow && props.cellEdit ? (
        <CellEditSheet
          open
          address={props.cellEdit.address}
          value={props.cellEdit.value}
          onCancel={props.onCancelCellEdit}
          onSubmit={props.onSubmitCellEdit}
        />
      ) : null}
    </>
  );
}
