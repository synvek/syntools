import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_TOOLS } from '../toolset';
import { Button } from './controls';

/**
 * 快捷键一览（F1 / `?` / 帮助菜单）。
 *
 * 工具部分直接读 `toolset.ts`，与工具箱角标共用同一份数据；
 * 编辑 / 视图部分列举的是 `interaction/keyboard.ts` 中真实存在的绑定，
 * 新增绑定时应同步此表（`toolset.test.ts` 守住工具侧的一致性）。
 */

interface Binding {
  keys: string;
  labelKey: string;
}

const EDIT_BINDINGS: Binding[] = [
  { keys: '⌘Z', labelKey: 'tools.photo.undo' },
  { keys: '⇧⌘Z', labelKey: 'tools.photo.redo' },
  { keys: '⌘C', labelKey: 'tools.photo.duplicate' },
  { keys: '⌘V', labelKey: 'tools.photo.ctxPaste' },
  { keys: '⌘A', labelKey: 'tools.photo.selectAll' },
  { keys: '⌘D', labelKey: 'tools.photo.deselect' },
  { keys: '⇧⌘I', labelKey: 'tools.photo.invertSelection' },
  { keys: '⌘J', labelKey: 'tools.photo.viaCopy' },
  { keys: 'Del', labelKey: 'tools.photo.ctxClear' },
  { keys: '⇧⌘C', labelKey: 'tools.photo.copySystem' },
  { keys: '⇧⌘V', labelKey: 'tools.photo.pasteSystem' },
  { keys: '⌘S', labelKey: 'tools.photo.exportImage' },
];

const VIEW_BINDINGS: Binding[] = [
  { keys: '⌘0', labelKey: 'tools.photo.zoomFit' },
  { keys: '⌘1', labelKey: 'tools.photo.zoomActual' },
  { keys: 'Space', labelKey: 'tools.photo.toolHand' },
  { keys: '[ / ]', labelKey: 'tools.photo.size' },
  { keys: 'X', labelKey: 'tools.photo.swapColors' },
  { keys: 'D', labelKey: 'tools.photo.resetColors' },
  { keys: 'F1', labelKey: 'tools.photo.shortcuts' },
];

function KeyRow({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-gray-600 dark:text-gray-300">{label}</span>
      <kbd className="shrink-0 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {keys}
      </kbd>
    </li>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'F1') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.photo.shortcuts')}
      onClick={onClose}
    >
      <div
        data-testid="shortcut-help"
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('tools.photo.shortcuts')}
          </h2>
          <Button onClick={onClose}>{t('tools.photo.close')}</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('tools.photo.shortcutsTools')}
            </h3>
            <ul className="flex flex-col gap-1">
              {ALL_TOOLS.map((tool) => (
                <KeyRow key={tool.id} keys={tool.shortcut} label={t(tool.labelKey)} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('tools.photo.shortcutsEdit')}
            </h3>
            <ul className="flex flex-col gap-1">
              {EDIT_BINDINGS.map((binding) => (
                <KeyRow key={binding.keys} keys={binding.keys} label={t(binding.labelKey)} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('tools.photo.shortcutsView')}
            </h3>
            <ul className="flex flex-col gap-1">
              {VIEW_BINDINGS.map((binding) => (
                <KeyRow key={binding.keys} keys={binding.keys} label={t(binding.labelKey)} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
