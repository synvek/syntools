import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';

export function SnapshotPanel() {
  const { t } = useTranslation();
  const snapshots = useFlowStore((s) => s.snapshots);
  const [name, setName] = useState('');

  const save = () => {
    const label = name.trim();
    useFlowStore.getState().saveSnapshot(label || new Date().toLocaleTimeString());
    setName('');
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tools.flowchart.snapshotName')}
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[13px] outline-none placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={save}
          className="h-8 shrink-0 rounded-md bg-blue-600 px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500"
        >
          {t('tools.flowchart.saveSnapshot')}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="py-2 text-center text-[12px] text-gray-400 dark:text-gray-500">
          {t('tools.flowchart.noSnapshot')}
        </p>
      ) : null}

      {snapshots.map((snap) => (
        <div
          key={snap.id}
          className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900/60"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-gray-700 dark:text-gray-200">
              {snap.name}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {new Date(snap.savedAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => useFlowStore.getState().restoreSnapshot(snap.id)}
            className="rounded px-1.5 py-1 text-[11px] text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            {t('tools.flowchart.restore')}
          </button>
          <button
            type="button"
            onClick={() => useFlowStore.getState().deleteSnapshot(snap.id)}
            className="rounded px-1.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            aria-label="delete"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
