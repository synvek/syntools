import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 手机端"改值"浮层（P2-8）。
 *
 * 为什么不直接依赖引擎的双击编辑器：手机上双击落在画布上的判定、软键盘顶起、光标定位都由引擎
 * 自己决定，工具既看不到也改不了。这里把"改一格的值"做成一条明确路径——选中格 → 点「编辑」→
 * 输入 → 写入，读的是**原值**（公式显示 `=…` 原文），写回时由 `parseCellInput` 决定是清空、
 * 公式、数值还是文本。
 *
 * 贴底而不是居中：手机上居中卡片会被软键盘顶掉半截，贴底 + `max-h` 更稳。
 */
export interface CellEditSheetProps {
  open: boolean;
  /** 例如 `B3`，仅用于告诉用户改的是哪一格 */
  address: string;
  /** 打开时的原值；有公式时是 `=…` 原文 */
  value: string;
  onCancel: () => void;
  onSubmit: (next: string) => void;
}

export function CellEditSheet({ open, address, value, onCancel, onSubmit }: CellEditSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  // 每次打开都用当前格的原值刷新草稿：取消后再次打开不能残留上一次的输入
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3" data-testid="sheet-cell-edit-sheet">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('tools.sheet.cellEditTitle', { cell: address })}
        className="rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {t('tools.sheet.cellEditTitle', { cell: address })}
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common.cancel')}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-black/[0.06] dark:text-gray-400 dark:hover:bg-white/10"
          >
            {t('common.cancel')}
          </button>
        </div>
        <input
          // 浮层唯一的输入框，打开即输入是移动端的预期（点一下才聚焦等于多点一下）
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t('tools.sheet.cellEditTitle', { cell: address })}
          data-testid="sheet-cell-edit-input"
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          // 公式、数字、文本都要能打：不要 inputMode="numeric"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.cellEditHint')}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-black/[0.04] dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="sheet-cell-edit-apply"
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            {t('tools.sheet.cellEditApply')}
          </button>
        </div>
      </form>
    </div>
  );
}
