/**
 * Flowchart editor copy registration: **split per language + loaded on demand**.
 *
 * Consistent with the project's "two-stage locale" approach: when the tool is lazy-loaded only the current language's small chunk
 * is fetched (~1/9 of the size) and merged into i18next under `tools.flowchart.*`;
 * switching languages loads the corresponding language again on demand.
 *
 * The template copy (`tpl_*`) is small and only exists in zh/en, so it is merged into the current language's resources
 * (non-zh/en languages use English, avoiding untranslated key names).
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

/** Supported languages (kept in sync with Lang in `core/i18n`) */
export const FLOWCHART_LANGS = Object.keys(LOADERS);

/** Normalize the current language: exact match → primary language match → fall back to English */
export function resolveFlowchartLang(lng?: string): string {
  if (!lng) return 'en';
  if (LOADERS[lng]) return lng;
  const lower = lng.toLowerCase();
  const exact = FLOWCHART_LANGS.find((item) => item.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split('-')[0];
  return FLOWCHART_LANGS.find((item) => item.toLowerCase() === base) ?? 'en';
}

/** Flatten a language bundle into i18next resources (shape names prefixed with `shape_`, template copy with `tpl_`) */
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

/** Registered languages (module-level cache, avoiding repeated fetches of the same chunk) */
const registered = new Set<string>();
/** Registrations in flight (concurrent calls share the same Promise) */
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

/** Register a single language (deduplicated + concurrent calls share a Promise) */
function ensureRegistered(instance: I18nLike, target: string): Promise<string> {
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

/**
 * Register the copy for the given language (defaults to i18next's current language).
 * Returns the language code actually registered so callers can check readiness.
 *
 * Non-English languages also register the **English bundle as a fallback**: when a language does not cover every key yet,
 * only then can i18next's `fallbackLng: ['en','zh']` resolve to English instead of the raw key name.
 * Resolves only after both bundles are ready, so no key names flash on the first frame.
 */
export function registerFlowchartStrings(instance: I18nLike, lng?: string): Promise<string> {
  const target = resolveFlowchartLang(lng ?? instance.language);
  const base =
    target === 'en' ? Promise.resolve('en') : ensureRegistered(instance, 'en').catch(() => 'en');
  return base.then(() => ensureRegistered(instance, target));
}

/** Whether the current language's copy is registered (the UI uses it to delay rendering and avoid flashing key names) */
export function hasFlowchartStrings(lng?: string): boolean {
  return registered.has(resolveFlowchartLang(lng));
}

/** For tests only: clear the registration caches */
export function __resetFlowchartStrings(): void {
  registered.clear();
  pending.clear();
}
