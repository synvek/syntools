import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import {
  bulkRename,
  DEFAULT_RENAME_RULES,
  findDuplicates,
  type CaseTransform,
  type RenameRules,
} from './core';

export default function BulkRenameTool() {
  const { t } = useTranslation();
  const [names, setNames] = useState('');
  const [rules, setRules] = useState<RenameRules>(DEFAULT_RENAME_RULES);

  const list = useMemo(
    () =>
      names
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean),
    [names],
  );
  const result = useMemo(() => bulkRename(list, rules), [list, rules]);
  const items = useMemo(() => (result.ok ? result.value : []), [result]);
  const duplicates = useMemo(() => findDuplicates(items), [items]);
  const output = items.map((i) => `${i.from} → ${i.to}`).join('\n');

  const patch = (partial: Partial<RenameRules>) => setRules((prev) => ({ ...prev, ...partial }));
  const patchNumbering = (partial: Partial<RenameRules['numbering']>) =>
    setRules((prev) => ({ ...prev, numbering: { ...prev.numbering, ...partial } }));

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.bulk-rename.prefix')}
          <input
            value={rules.prefix}
            onChange={(e) => patch({ prefix: e.target.value })}
            className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.bulk-rename.suffix')}
          <input
            value={rules.suffix}
            onChange={(e) => patch({ suffix: e.target.value })}
            className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.bulk-rename.extension')}
          <input
            value={rules.newExtension}
            onChange={(e) => patch({ newExtension: e.target.value })}
            placeholder=".txt"
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ClearButton
          onClick={() => {
            setNames('');
            setRules(DEFAULT_RENAME_RULES);
          }}
        />
      </OptionBar>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          {t('tools.bulk-rename.search')}
          <input
            value={rules.search}
            onChange={(e) => patch({ search: e.target.value })}
            className="w-32 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2">
          {t('tools.bulk-rename.replace')}
          <input
            value={rules.replace}
            onChange={(e) => patch({ replace: e.target.value })}
            className="w-32 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.useRegex}
            onChange={(e) => patch({ useRegex: e.target.checked })}
            className="rounded border-gray-300"
          />
          {t('tools.bulk-rename.useRegex')}
        </label>
        <label className="flex items-center gap-2">
          {t('tools.bulk-rename.case')}
          <select
            value={rules.caseTransform}
            onChange={(e) => patch({ caseTransform: e.target.value as CaseTransform })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="none">{t('tools.bulk-rename.cases.none')}</option>
            <option value="lower">{t('tools.bulk-rename.cases.lower')}</option>
            <option value="upper">{t('tools.bulk-rename.cases.upper')}</option>
            <option value="title">{t('tools.bulk-rename.cases.title')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.numbering.enabled}
            onChange={(e) => patchNumbering({ enabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          {t('tools.bulk-rename.numbering')}
        </label>
        {rules.numbering.enabled && (
          <>
            <label className="flex items-center gap-1">
              {t('tools.bulk-rename.start')}
              <input
                type="number"
                value={rules.numbering.start}
                onChange={(e) => patchNumbering({ start: Number(e.target.value) || 1 })}
                className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="flex items-center gap-1">
              {t('tools.bulk-rename.padding')}
              <input
                type="number"
                min={1}
                max={8}
                value={rules.numbering.padding}
                onChange={(e) =>
                  patchNumbering({ padding: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-14 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <select
              value={rules.numbering.position}
              onChange={(e) => patchNumbering({ position: e.target.value as 'prefix' | 'suffix' })}
              aria-label={t('tools.bulk-rename.position')}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="prefix">{t('tools.bulk-rename.positions.prefix')}</option>
              <option value="suffix">{t('tools.bulk-rename.positions.suffix')}</option>
            </select>
          </>
        )}
      </div>

      <FileDropZone
        multiple
        onFiles={(files) => setNames(files.map((f) => f.name).join('\n'))}
        onFile={() => undefined}
        hint={t('tools.bulk-rename.dropHint')}
      />

      <IOTextArea
        label={t('tools.bulk-rename.names')}
        value={names}
        onChange={setNames}
        rows={8}
        placeholder={t('tools.bulk-rename.namesPlaceholder')}
        actions={<ClearButton onClick={() => setNames('')} disabled={!names} />}
      />

      {!result.ok && names && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.bulk-rename.errors.${result.error}`)}
        </p>
      )}

      {duplicates.length > 0 && (
        <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.bulk-rename.duplicateWarning', { names: duplicates.join(', ') })}
        </p>
      )}

      <IOTextArea
        label={t('tools.bulk-rename.output')}
        value={output}
        readOnly
        rows={8}
        actions={<CopyButton text={output} disabled={!output} />}
      />
    </div>
  );
}
