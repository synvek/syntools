import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { DOCUMENT_TEMPLATES, type DocumentTemplate } from './templates';

interface TemplatePanelProps {
  /** 当前已套用的模板 id */
  activeId?: string;
  onApply: (template: DocumentTemplate) => void;
  onClose: () => void;
}

/** 页面设置摘要：纸张 / 方向 / 边距 / 分栏，让用户在套用前就能判断版式 */
function summarize(
  template: DocumentTemplate,
  labels: {
    paper: string;
    landscape: string;
    portrait: string;
    columns: string;
    watermark: string;
    background: string;
  },
): string[] {
  const setup = template.pageSetup;
  const parts: string[] = [];
  if (setup.size) parts.push(`${labels.paper} ${setup.size}`);
  if (setup.orientation) {
    parts.push(setup.orientation === 'landscape' ? labels.landscape : labels.portrait);
  }
  if (setup.columns && setup.columns > 1) parts.push(`${labels.columns} ${setup.columns}`);
  if (setup.watermark) parts.push(labels.watermark);
  if (setup.background) parts.push(labels.background);
  return parts;
}

/**
 * 模板面板：卡片式列表，左侧为版式摘要，右侧为名称与描述，主按钮「套用」。
 * 套用前面板会先确认（避免覆盖正在编辑的内容），确认逻辑由工具层负责。
 */
export function TemplatePanel({ activeId, onApply, onClose }: TemplatePanelProps) {
  const { t } = useTranslation();
  const summaryLabels = {
    paper: t('tools.richText.templateSummaryPaper'),
    landscape: t('tools.richText.landscape'),
    portrait: t('tools.richText.portrait'),
    columns: t('tools.richText.columns'),
    watermark: t('tools.richText.watermark'),
    background: t('tools.richText.backgroundColor'),
  };

  return (
    <div
      data-testid="rich-text-templates"
      className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.templates')}
        </span>
        <button
          type="button"
          aria-label={t('tools.richText.templatesClose')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {DOCUMENT_TEMPLATES.map((template) => {
          const active = template.id === activeId;
          return (
            <li
              key={template.id}
              className={`flex items-start gap-3 rounded-lg border p-2 transition-colors ${
                active
                  ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div
                aria-hidden="true"
                className="flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800"
              >
                <span className="h-1 w-6 rounded bg-gray-300 dark:bg-gray-600" />
                <span className="h-0.5 w-7 rounded bg-gray-200 dark:bg-gray-700" />
                <span className="h-0.5 w-7 rounded bg-gray-200 dark:bg-gray-700" />
                <span className="h-0.5 w-5 rounded bg-gray-200 dark:bg-gray-700" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {t(`tools.richText.${template.nameKey}`)}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t(`tools.richText.${template.descriptionKey}`)}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {summarize(template, summaryLabels).join(' · ')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onApply(template)}
                className={`h-7 shrink-0 rounded-md px-2 text-xs transition-colors ${
                  active
                    ? 'border border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {active ? t('tools.richText.templateApplied') : t('tools.richText.templateApply')}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
