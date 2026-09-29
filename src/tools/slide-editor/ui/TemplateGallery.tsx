import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SLIDE_TEMPLATES, TEMPLATE_CATEGORIES, templateSwatch } from '../model/templates';
import { useSlideStore } from '../store';
import { Section } from './controls';

/**
 * 模板画廊：卡片式预览 + 按场景筛选 + 一键套用。
 *
 * 模板是纯本地数据（主题色板 + 母版 + 版式），套用后走 `applyTemplate`，
 * 与导入的文稿共用同一条母版/版式结构，因此能原样导出到 .pptx。
 */

const ALL = '__all__';

export function TemplateGallery() {
  const { t } = useTranslation();
  const applyTemplate = useSlideStore((s) => s.applyTemplate);
  const currentTheme = useSlideStore((s) => s.doc.theme.name);
  const [category, setCategory] = useState<string>(ALL);

  const list = useMemo(
    () =>
      category === ALL
        ? SLIDE_TEMPLATES
        : SLIDE_TEMPLATES.filter((template) => template.category === category),
    [category],
  );

  return (
    <Section title={t('tools.slide.templateGallery')}>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory(ALL)}
          className={`h-6 rounded-md border px-2 text-[11px] transition-colors ${
            category === ALL
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950'
              : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-300'
          }`}
        >
          {t('tools.slide.templateAll')}
        </button>
        {TEMPLATE_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`h-6 rounded-md border px-2 text-[11px] transition-colors ${
              category === item
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950'
                : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            {t(`tools.slide.tplCat${item}`)}
          </button>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        {category === ALL ? t('tools.slide.templateHint') : t(`tools.slide.tplCatDesc${category}`)}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {list.map((template) => {
          const swatch = templateSwatch(template);
          const active = template.theme.name === currentTheme;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
              title={t(`tools.slide.tpl${template.nameKey}`)}
              className={`group flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                active
                  ? 'border-blue-500 ring-1 ring-blue-200 dark:ring-blue-900'
                  : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'
              }`}
            >
              {/* 缩略图：用主题色拼一个抽象版式预览，避免加载任何外部图片 */}
              <div className="flex h-12 w-full flex-col justify-between overflow-hidden rounded border border-gray-100 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-1">
                  {swatch.slice(0, 3).map((color) => (
                    <span
                      key={color}
                      className="h-1.5 flex-1 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className="h-1.5 w-3/4 rounded-full"
                    style={{ backgroundColor: swatch[0] }}
                  />
                  <span className="h-1 w-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <span className="h-1 w-2/3 rounded-full bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
              <span className="truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.slide.tpl${template.nameKey}`)}
              </span>
              <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                {t(`tools.slide.tplCat${template.category}`)}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
