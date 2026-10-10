import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LINE_HEIGHT,
  VERTICAL_ALIGN_OPTIONS,
  type FlowNodePatch,
  type FlowNodeStyleView,
  type VerticalAlign,
} from '../model/types';
import { safeLinkHref } from '../core';

const inputCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

const VERTICAL_ALIGN_KEY: Record<VerticalAlign, string> = {
  top: 'alignTop',
  middle: 'alignMiddle',
  bottom: 'alignBottom',
};

/**
 * 节点「文本排版」分组：垂直对齐 / 行高 / 文字自动缩放 / 标签背景色 / 超链接。
 * 自动缩放的度量与渲染在 `ShapeNode`（ResizeObserver + 二分），此处只写入开关。
 */
export function NodeTextSection({
  style,
  patch,
  onEnd,
  fallback,
  isContainer,
}: {
  style: FlowNodeStyleView;
  patch: (p: FlowNodePatch) => void;
  onEnd: () => void;
  fallback: FlowNodeStyleView;
  /** 容器（泳道/编组）文本由标题栏承载，垂直对齐与行高无意义 */
  isContainer: boolean;
}) {
  const { t } = useTranslation();
  const verticalAlign = style.verticalAlign ?? fallback.verticalAlign ?? 'middle';
  const lineHeight = style.lineHeight ?? fallback.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const link = style.link ?? fallback.link ?? '';
  const linkValid = !link || safeLinkHref(link) !== undefined;

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.textLayout')}
      </h3>

      {isContainer ? null : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t('tools.flowchart.verticalAlign')}
            </span>
            <div className="flex gap-1">
              {VERTICAL_ALIGN_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`flowchart-va-${v}`}
                  onClick={() => patch({ style: { verticalAlign: v } })}
                  onBlur={onEnd}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                    verticalAlign === v
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {t(`tools.flowchart.${VERTICAL_ALIGN_KEY[v]}`)}
                </button>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {`${t('tools.flowchart.lineHeight')} ${lineHeight.toFixed(2)}`}
            </span>
            <input
              type="range"
              min={0.8}
              max={3}
              step={0.05}
              value={lineHeight}
              aria-label={t('tools.flowchart.lineHeight')}
              data-testid="flowchart-line-height"
              onChange={(e) => patch({ style: { lineHeight: Number(e.target.value) } })}
              onBlur={onEnd}
              className="w-full accent-blue-500"
            />
          </label>

          <button
            type="button"
            data-testid="flowchart-auto-shrink"
            onClick={() => patch({ style: { autoShrink: style.autoShrink !== true } })}
            onBlur={onEnd}
            className={`w-full rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
              style.autoShrink === true
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t('tools.flowchart.autoShrink')}
          </button>

          {/* 文本格式：纯文本 / Markdown（行内语法在 ShapeNode 中渲染） */}
          <button
            type="button"
            data-testid="flowchart-text-format"
            aria-pressed={style.textFormat === 'markdown'}
            onClick={() =>
              patch({
                style: { textFormat: style.textFormat === 'markdown' ? 'plain' : 'markdown' },
              })
            }
            onBlur={onEnd}
            className={`w-full rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
              style.textFormat === 'markdown'
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {`${t('tools.flowchart.textFormat')}: ${
              style.textFormat === 'markdown'
                ? t('tools.flowchart.textFormatMarkdown')
                : t('tools.flowchart.textFormatPlain')
            }`}
          </button>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.labelBackground')}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t('tools.flowchart.labelBackground')}
            data-testid="flowchart-label-bg"
            className="h-8 w-12 cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={style.labelBackground ?? fallback.labelBackground ?? '#ffffff'}
            onChange={(e) => patch({ style: { labelBackground: e.target.value } })}
            onBlur={onEnd}
          />
          <button
            type="button"
            onClick={() => patch({ style: { labelBackground: undefined } })}
            onBlur={onEnd}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('tools.flowchart.clear')}
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {t('tools.flowchart.link')}
        </span>
        <input
          className={inputCls}
          placeholder="https://"
          data-testid="flowchart-link"
          value={link}
          onChange={(e) => patch({ style: { link: e.target.value || undefined } })}
          onBlur={onEnd}
        />
        {linkValid ? null : (
          <span className="text-[11px] text-rose-500">{t('tools.flowchart.linkInvalid')}</span>
        )}
      </label>
    </div>
  );
}
