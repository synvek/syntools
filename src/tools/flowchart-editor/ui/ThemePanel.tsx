import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { applyTheme, copyNodeStyle, pasteNodeStyle } from '../flowOps';
import { THEMES, type ThemeId } from '../model/themes';

const btnCls =
  'flex-1 rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10';

/** 主题 / 样式预设 + 格式刷（工具栏弹层） */
export function ThemePanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('business');
  const brush = useFlowStore((s) => s.styleBrush);
  const selectedCount = useFlowStore((s) => s.selectedNodes.length);

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="flowchart-theme-toggle"
        onClick={() => setOpen((v) => !v)}
        title={t('tools.flowchart.theme')}
        aria-label={t('tools.flowchart.theme')}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${
          open
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <span
          className="h-3.5 w-3.5 rounded-sm border"
          style={{
            background: THEMES.find((item) => item.id === theme)?.swatch.fill,
            borderColor: THEMES.find((item) => item.id === theme)?.swatch.stroke,
          }}
        />
        {t('tools.flowchart.theme')}
      </button>

      {open ? (
        <div className="absolute left-0 top-9 z-30 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-1">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`flowchart-theme-${item.id}`}
                onClick={() => setTheme(item.id)}
                className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[12px] transition-colors ${
                  theme === item.id
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border"
                  style={{ background: item.swatch.fill, borderColor: item.swatch.stroke }}
                />
                <span className="truncate">{t(`tools.flowchart.theme${item.labelKey}`)}</span>
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              data-testid="flowchart-theme-all"
              onClick={() => applyTheme(theme, 'all')}
              className={btnCls}
            >
              {t('tools.flowchart.applyThemeAll')}
            </button>
            <button
              type="button"
              data-testid="flowchart-theme-selection"
              onClick={() => applyTheme(theme, 'selection')}
              disabled={selectedCount === 0}
              className={btnCls}
            >
              {t('tools.flowchart.applyThemeSelection')}
            </button>
          </div>

          <div className="mt-2 flex gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              data-testid="flowchart-style-copy"
              onClick={() => copyNodeStyle()}
              disabled={selectedCount === 0}
              className={btnCls}
            >
              {t('tools.flowchart.formatBrush')}
            </button>
            <button
              type="button"
              data-testid="flowchart-style-paste"
              onClick={() => pasteNodeStyle()}
              disabled={!brush || selectedCount === 0}
              className={btnCls}
            >
              {t('tools.flowchart.applyStyle')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
