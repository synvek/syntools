import { useTranslation } from 'react-i18next';
import { useMindStore } from '../store';
import { MIND_THEMES } from '../model/themes';

/** 配色主题：一套主题同时决定中心主题 / 一级分支 / 叶子的形状与配色 */
export function ThemePanel() {
  const { t } = useTranslation();
  const themeId = useMindStore((s) => s.doc.themeId);
  const setTheme = useMindStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-2 p-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.mindmap.theme')}
      </h2>

      <div className="grid grid-cols-1 gap-1.5">
        {MIND_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            title={t(`tools.mindmap.theme_${theme.id}`)}
            aria-label={t(`tools.mindmap.theme_${theme.id}`)}
            onClick={() => setTheme(theme.id)}
            className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
              themeId === theme.id
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-500/10'
                : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'
            }`}
          >
            {/* 预览：中心主题 → 一级分支 → 叶子 的层级色块 */}
            <span className="flex shrink-0 items-center gap-[3px]">
              <span
                className="h-5 w-2.5 rounded-sm"
                style={{ background: theme.root.fill }}
                aria-hidden="true"
              />
              <span
                className="h-4 w-2.5 rounded-sm"
                style={{ background: theme.branches[0] }}
                aria-hidden="true"
              />
              <span
                className="h-3 w-2.5 rounded-sm"
                style={{ background: theme.branches[1] ?? theme.branches[0] }}
                aria-hidden="true"
              />
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-[12px] ${
                themeId === theme.id
                  ? 'font-medium text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {t(`tools.mindmap.theme_${theme.id}`)}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        {t('tools.mindmap.themeHint')}
      </p>
    </div>
  );
}
