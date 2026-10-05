/**
 * 流程图编辑器文案注册：**按语种拆分 + 按需加载**。
 *
 * 与项目「两段式 locale」保持一致：工具被懒加载时只取当前语言的小 chunk
 * （约 1/9 体积），再按 `tools.flowchart.*` 合并进 i18next；
 * 切换语言时重新按需加载对应语种。
 *
 * 模板文案（`tpl_*`）体量小且只有 zh/en，直接并入当前语种资源
 * （非 zh/en 时使用英文，避免出现未翻译的键名）。
 */

import { TEMPLATE_LABELS_I18N, TEMPLATE_LABEL_PREFIX } from '../model/templateLabels';
import type { LangBundle, ResourceTree, StringTree } from './types';

export type { LangBundle, ResourceTree, ShapeLabelMap, StringTree } from './types';

type Loader = () => Promise<{ default: LangBundle }>;

const LOADERS: Record<string, Loader> = {
  zh: () => import('./zh'),
  en: () => import('./en'),
  'zh-TW': () => import('./zhTW'),
  ja: () => import('./ja'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  it: () => import('./it'),
  es: () => import('./es'),
  pt: () => import('./pt'),
};

/** 支持的语言（与 `core/i18n` 的 Lang 保持一致） */
export const FLOWCHART_LANGS = Object.keys(LOADERS);

/** 归一当前语言：精确匹配 → 主语言匹配 → 回退英文 */
export function resolveFlowchartLang(lng?: string): string {
  if (!lng) return 'en';
  if (LOADERS[lng]) return lng;
  const lower = lng.toLowerCase();
  const exact = FLOWCHART_LANGS.find((item) => item.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split('-')[0];
  return FLOWCHART_LANGS.find((item) => item.toLowerCase() === base) ?? 'en';
}

/** 把语种 bundle 摊平成 i18next 资源（图形名加 `shape_`、模板文案加 `tpl_` 前缀） */
export function bundleToResource(lng: string, bundle: LangBundle): ResourceTree {
  const extra: StringTree = {};
  for (const [kind, name] of Object.entries(bundle.shapes ?? {})) {
    extra[`shape_${kind}`] = name;
  }
  const templates = TEMPLATE_LABELS_I18N[lng] ?? TEMPLATE_LABELS_I18N.en;
  for (const [token, text] of Object.entries(templates ?? {})) {
    extra[`${TEMPLATE_LABEL_PREFIX}${token}`] = text;
  }
  return { tools: { flowchart: { ...bundle.ui.tools.flowchart, ...extra } } };
}

/** 已注册的语种（模块级缓存，避免重复请求同一 chunk） */
const registered = new Set<string>();
/** 进行中的注册（并发调用共享同一 Promise） */
const pending = new Map<string, Promise<string>>();

interface I18nLike {
  language?: string;
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: ResourceTree,
    deep: boolean,
    overwrite: boolean,
  ) => void;
}

/**
 * 注册指定语种（缺省取 i18next 当前语言）的文案。
 * 返回实际注册的语种码，便于调用方判断就绪状态。
 */
export function registerFlowchartStrings(instance: I18nLike, lng?: string): Promise<string> {
  const target = resolveFlowchartLang(lng ?? instance.language);
  if (registered.has(target)) return Promise.resolve(target);
  const running = pending.get(target);
  if (running) return running;

  const task = LOADERS[target]()
    .then(({ default: bundle }) => {
      instance.addResourceBundle(
        target,
        'translation',
        bundleToResource(target, bundle),
        true,
        true,
      );
      registered.add(target);
      return target;
    })
    .finally(() => {
      pending.delete(target);
    });
  pending.set(target, task);
  return task;
}

/** 当前语言文案是否已注册（UI 用它决定是否延迟渲染，避免闪现键名） */
export function hasFlowchartStrings(lng?: string): boolean {
  return registered.has(resolveFlowchartLang(lng));
}

/** 仅测试使用：清空注册缓存 */
export function __resetFlowchartStrings(): void {
  registered.clear();
  pending.clear();
}
