import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SheetProtectionFlags, SheetProtectionState } from '../sheetProtection';

/**
 * 工作表保护（P2-S7.2）：开关 + 可选密码 + "允许的操作"。
 *
 * 只暴露常用的五个允许项。其余属性（插入/删除行列、超链接等）在导入文件里可能已经设成允许，
 * 那部分由快照原样带着走，界面不去碰它们 —— 面板不显示的开关不该被面板悄悄改掉。
 */

interface ProtectDialogProps {
  sheetName: string;
  /** 当前保护状态（null = 未保护） */
  state: SheetProtectionState | null;
  busy?: boolean;
  onApply: (input: { enabled: boolean; flags: SheetProtectionFlags; password: string }) => void;
  onClose: () => void;
}

const ALLOW_KEYS = [
  'selectLockedCells',
  'selectUnlockedCells',
  'formatCells',
  'sort',
  'autoFilter',
] as const;

const ALLOW_LABEL: Record<(typeof ALLOW_KEYS)[number], string> = {
  selectLockedCells: 'tools.sheet.protectAllowSelectLocked',
  selectUnlockedCells: 'tools.sheet.protectAllowSelectUnlocked',
  formatCells: 'tools.sheet.protectAllowFormat',
  sort: 'tools.sheet.protectAllowSort',
  autoFilter: 'tools.sheet.protectAllowFilter',
};

export function ProtectDialog({
  sheetName,
  state,
  busy = false,
  onApply,
  onClose,
}: ProtectDialogProps) {
  const { t } = useTranslation();
  const active = state?.enabled ?? false;
  const [flags, setFlags] = useState<SheetProtectionFlags>(() => ({
    // 未保护时按 Excel 的默认值起步：能选择单元格，其余禁止
    selectLockedCells: state?.flags.selectLockedCells ?? true,
    selectUnlockedCells: state?.flags.selectUnlockedCells ?? true,
    formatCells: state?.flags.formatCells ?? false,
    sort: state?.flags.sort ?? false,
    autoFilter: state?.flags.autoFilter ?? false,
  }));
  const [password, setPassword] = useState('');

  const toggle = (key: (typeof ALLOW_KEYS)[number]) => {
    setFlags((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.protectTitle')}
      data-testid="sheet-protect-dialog"
    >
      <div className="flex w-full max-w-md flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('tools.sheet.protectTitle')}
          </h2>
          <span className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {sheetName}
          </span>
          <button
            type="button"
            className="ml-auto rounded px-2 py-0.5 text-[12px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label={t('tools.sheet.protectCancel')}
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.sheet.protectLockedHint')}
        </p>

        {active ? null : (
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-[11px] text-gray-600 dark:text-gray-300" htmlFor="protect-pw">
              {t('tools.sheet.protectPassword')}
            </label>
            <input
              id="protect-pw"
              type="password"
              className="h-7 rounded-md border border-gray-200 bg-transparent px-2 text-[11px] dark:border-gray-700"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {t('tools.sheet.protectPasswordHint')}
            </p>
          </div>
        )}

        <fieldset className="mt-3 flex flex-col gap-1" disabled={busy}>
          <legend className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {t('tools.sheet.protectAllow')}
          </legend>
          {ALLOW_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-200"
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={flags[key] === true}
                onChange={() => toggle(key)}
              />
              {t(ALLOW_LABEL[key])}
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className={
              active
                ? 'rounded-md border border-gray-200 px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                : 'rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-40'
            }
            disabled={busy}
            onClick={() => onApply({ enabled: !active, flags, password })}
          >
            {active ? t('tools.sheet.protectDisable') : t('tools.sheet.protectEnable')}
          </button>
          <button
            type="button"
            className="ml-auto rounded-md border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            {t('tools.sheet.protectCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
