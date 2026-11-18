import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import {
  EDITOR_STRIP_TITLE_INPUT_CLASS,
  STRIP_ICON_BUTTON_CLASS,
} from '@/core/components/editorChrome';

/**
 * Ribbon 右上角那条工具条（P2-4 第十五片）。
 *
 * 它原来是 `headerRight={<>…</>}` 里 70 行内联 JSX，混着三种完全不同的东西：
 *
 * 1. **状态徽标**——受保护（锁）、活动表的表格数、草稿是否已保存。三个都是 `role="status"`，
 *    因为它们会变，读屏应该听到变化；用色也刻意不同（保护琥珀 / 表格天蓝 / 已保存绿）。
 * 2. **一次性动作**——清空、新建、演示。清空在空文档上禁用（`clearDisabled` 由调用方算），
 *    这条判断依赖"有没有内容"，属于业务规则，不在这里重算。
 * 3. **文档标题**——受控输入，直接写回 `title`，没有本地草稿（标题改动会触发落盘，防抖在持久化层）。
 *
 * 抽出来的理由不是行数，而是**这三种东西的语义完全不同，混在一个 `<>` 里没人能一眼分清哪些会变、
 * 哪些点了会发生什么**。抽出来之后，`aria-label` / `title` / 禁用态都跟着各自的元素走。
 */
export interface SheetHeaderStripProps {
  /** 活动表是否开启保护：徽标 + 悬停说明 */
  protectedSheet: boolean;
  /** 活动表上的表格数量，0 时不显示徽标 */
  tableCount: number;
  /** 草稿是否已落盘（决定绿勾 / 灰钟） */
  draftSaved: boolean;
  /** 已保存状态的悬停说明 */
  statusText: string;
  title: string;
  onTitleChange: (value: string) => void;
  /** 空文档（无格子且无标题）时清空没有意义 */
  clearDisabled: boolean;
  onClear: () => void;
  onNewDoc: () => void;
  onPresent: () => void;
}

export function SheetHeaderStrip(props: SheetHeaderStripProps) {
  const { t } = useTranslation();

  return (
    <>
      {props.protectedSheet ? (
        <span
          role="status"
          data-testid="sheet-protected-badge"
          title={t('tools.sheet.protectLockedNotice')}
          aria-label={t('tools.sheet.protectLockedNotice')}
          className="inline-flex h-6 items-center justify-center rounded bg-amber-50 px-1.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        >
          <Icon name="lock" className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {props.tableCount > 0 ? (
        <span
          role="status"
          data-testid="sheet-table-badge"
          title={t('tools.sheet.tableBadge', { count: props.tableCount })}
          aria-label={t('tools.sheet.tableBadge', { count: props.tableCount })}
          className="inline-flex h-6 items-center rounded bg-sky-50 px-1.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        >
          {props.tableCount}
        </span>
      ) : null}
      <span
        role="status"
        title={props.statusText}
        aria-label={props.statusText}
        className={`inline-flex h-6 w-6 items-center justify-center rounded ${
          props.draftSaved
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <Icon name={props.draftSaved ? 'check' : 'clock'} className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        onClick={props.onClear}
        disabled={props.clearDisabled}
        aria-label={t('common.clear')}
        title={t('common.clear')}
        className={`${STRIP_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
      <HintTip text={t('tools.sheet.unsupportedTip')} />
      <input
        type="text"
        value={props.title}
        aria-label={t('tools.sheet.docTitle')}
        placeholder={t('tools.sheet.titlePlaceholder')}
        onChange={(event) => props.onTitleChange(event.target.value)}
        className={EDITOR_STRIP_TITLE_INPUT_CLASS}
      />
      <button
        type="button"
        onClick={props.onNewDoc}
        aria-label={t('common.newDoc')}
        title={t('common.newDoc')}
        className={STRIP_ICON_BUTTON_CLASS}
      >
        <Icon name="sheet" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-testid="sheet-present"
        onClick={props.onPresent}
        aria-label={t('tools.sheet.present')}
        title={t('tools.sheet.present')}
        className={STRIP_ICON_BUTTON_CLASS}
      >
        <Icon name="present" className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
