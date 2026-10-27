import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PropertyPanel } from './PropertyPanel';
import { ThemePanel } from './ThemePanel';

/** Right-hand inspector: Properties / Theme tabs (same layout as the flowchart editor's right panel) */
const PANELS = ['prop', 'theme'] as const;
type PanelKey = (typeof PANELS)[number];

export function Inspector() {
  const { t } = useTranslation();
  const [panel, setPanel] = useState<PanelKey>('prop');

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex gap-1">
        {PANELS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPanel(key)}
            className={`flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
              panel === key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-blue-50 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-blue-500/10'
            }`}
          >
            {t(key === 'prop' ? 'tools.mindmap.panelTitle' : 'tools.mindmap.themes')}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === 'prop' ? <PropertyPanel /> : <ThemePanel />}
      </div>
    </aside>
  );
}
