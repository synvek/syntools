import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeRef, validateName, type NamedRange } from '../namedRanges';

/**
 * 名称管理器（P2-S7.1）。
 *
 * 纯受控：名称列表由 `SpreadsheetTool` 持有（快照字段 `namedRanges`），面板只负责编辑。
 * 为什么不做"确定/取消"：名称是逐条独立的元数据，边改边生效比攒一批再提交更接近 Excel，
 * 也让"改错了立刻改回来"的成本降到一次输入。
 */

interface NameManagerPanelProps {
  names: NamedRange[];
  /** 可选的作用范围（当前工作簿的可见表） */
  sheets: { id: string; name: string }[];
  activeSheetId: string | null;
  /** 当前选区（`A1:B2`），用于"用选区填入" */
  selectionRef: string | null;
  onChange: (next: NamedRange[]) => void;
  onClose: () => void;
}

const ERROR_KEY = {
  empty: 'tools.sheet.namesErrorEmpty',
  invalid: 'tools.sheet.namesErrorInvalid',
  reserved: 'tools.sheet.namesErrorInvalid',
  duplicate: 'tools.sheet.namesErrorDuplicate',
} as const;

export function NameManagerPanel({
  names,
  sheets,
  activeSheetId,
  selectionRef,
  onChange,
  onClose,
}: NameManagerPanelProps) {
  const { t } = useTranslation();
  const [seq, setSeq] = useState(0);

  const update = (id: string, patch: Partial<NamedRange>) => {
    onChange(names.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const add = () => {
    setSeq((value) => value + 1);
    onChange([
      ...names,
      {
        id: `name-new-${Date.now().toString(36)}-${seq + 1}`,
        name: '',
        ref: selectionRef ?? '',
      },
    ]);
  };

  const remove = (id: string) => onChange(names.filter((item) => item.id !== id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.namesTitle')}
      data-testid="sheet-name-manager"
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('tools.sheet.namesTitle')}
          </h2>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {names.length}
          </span>
          <button
            type="button"
            className="ml-auto rounded px-2 py-0.5 text-[12px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label={t('tools.sheet.namesClose')}
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.sheet.namesHint')}
        </p>

        <div className="mt-3 min-h-16 flex-1 overflow-auto">
          {names.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('tools.sheet.namesEmpty')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {names.map((item) => {
                const nameError = validateName(item.name, names, item.id);
                const refError = normalizeRef(item.ref) === null;
                return (
                  <div
                    key={item.id}
                    className="rounded-md border border-gray-200 p-2 dark:border-gray-700"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        className="h-7 w-32 rounded-md border border-gray-200 bg-transparent px-2 text-[11px] dark:border-gray-700"
                        value={item.name}
                        placeholder={t('tools.sheet.namesName')}
                        aria-label={t('tools.sheet.namesName')}
                        onChange={(event) => update(item.id, { name: event.target.value })}
                      />
                      <input
                        className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2 text-[11px] dark:border-gray-700"
                        value={item.ref}
                        placeholder={t('tools.sheet.namesRef')}
                        aria-label={t('tools.sheet.namesRef')}
                        onChange={(event) => update(item.id, { ref: event.target.value })}
                      />
                      <select
                        className="h-7 rounded-md border border-gray-200 bg-transparent px-1 text-[11px] dark:border-gray-700"
                        value={item.sheetId ?? ''}
                        aria-label={t('tools.sheet.namesScope')}
                        onChange={(event) =>
                          update(item.id, {
                            sheetId: event.target.value ? event.target.value : undefined,
                          })
                        }
                      >
                        <option value="">{t('tools.sheet.namesScopeWorkbook')}</option>
                        {sheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                        title={t('tools.sheet.namesUseSelection')}
                        disabled={!selectionRef}
                        onClick={() => selectionRef && update(item.id, { ref: selectionRef })}
                      >
                        ⌖
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        aria-label={t('tools.sheet.namesDelete')}
                        onClick={() => remove(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        className="h-6 min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2 text-[10px] dark:border-gray-700"
                        value={item.comment ?? ''}
                        placeholder={t('tools.sheet.namesComment')}
                        aria-label={t('tools.sheet.namesComment')}
                        onChange={(event) => update(item.id, { comment: event.target.value })}
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {item.sheetId
                          ? (sheets.find((sheet) => sheet.id === item.sheetId)?.name ??
                            t('tools.sheet.namesScope'))
                          : t('tools.sheet.namesScopeWorkbook')}
                      </span>
                    </div>
                    {nameError || refError ? (
                      <p className="mt-1 text-[10px] text-red-500">
                        {nameError ? t(ERROR_KEY[nameError]) : t('tools.sheet.namesErrorRef')}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
            onClick={add}
          >
            {t('tools.sheet.namesAdd')}
          </button>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {activeSheetId ? (sheets.find((sheet) => sheet.id === activeSheetId)?.name ?? '') : ''}
          </span>
          <button
            type="button"
            className="ml-auto rounded-md border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            {t('tools.sheet.namesClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
