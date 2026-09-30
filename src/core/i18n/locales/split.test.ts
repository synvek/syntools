import { describe, expect, it } from 'vitest';
import de from './de';
import deTools from './de.tools';
import en from './en';
import enTools from './en.tools';
import es from './es';
import esTools from './es.tools';
import fr from './fr';
import frTools from './fr.tools';
import itLocale from './it';
import itTools from './it.tools';
import ja from './ja';
import jaTools from './ja.tools';
import pt from './pt';
import ptTools from './pt.tools';
import zh from './zh';
import zhTools from './zh.tools';
import zhTW from './zh-TW';
import zhTWTools from './zh-TW.tools';
import { LANGS, SYNC_LANGS } from '@/core/i18n/types';

/**
 * 语言资源「外壳 / 工具文案」拆分的结构门禁。
 *
 * 拆分动机见 `locales/index.ts`：`tools.*` 占语言包约 82%，只有工具页需要，
 * 因此从首屏同步包里剥离、随工具页按需加载（首屏 209 KB → 158 KB）。
 *
 * 这条测试守住拆分的三个前提，避免后续维护把性能收益悄悄还回去：
 * 1. 外壳里**不能**再出现 `tools`（否则又回到首屏）；
 * 2. `tools` 模块里**只能**有 `tools`（否则会重复加载外壳文案）；
 * 3. `toolsMeta` 必须留在外壳（首页/侧栏/搜索在首帧就要用它）。
 */

const shells = { zh, en, 'zh-TW': zhTW, ja, fr, de, it: itLocale, es, pt } as Record<
  string,
  Record<string, unknown>
>;
const toolBundles = {
  zh: zhTools,
  en: enTools,
  'zh-TW': zhTWTools,
  ja: jaTools,
  fr: frTools,
  de: deTools,
  it: itTools,
  es: esTools,
  pt: ptTools,
} as Record<string, Record<string, unknown>>;

describe('语言包拆分：外壳 / 工具文案', () => {
  it('9 种语言都同时提供外壳与工具文案', () => {
    expect(Object.keys(shells).sort()).toEqual([...LANGS].sort());
    expect(Object.keys(toolBundles).sort()).toEqual([...LANGS].sort());
  });

  it('外壳里不含 tools.*（否则首屏会重新背上 82% 的语言包）', () => {
    const offenders = LANGS.filter((lang) => 'tools' in (shells[lang] ?? {}));
    expect(offenders).toEqual([]);
  });

  it('工具文案模块里只有 tools.*', () => {
    const offenders = LANGS.filter((lang) => {
      const keys = Object.keys(toolBundles[lang] ?? {});
      return keys.length !== 1 || keys[0] !== 'tools';
    });
    expect(offenders).toEqual([]);
  });

  it('toolsMeta 留在外壳（首页 / 侧栏 / 搜索首帧需要）', () => {
    const offenders = LANGS.filter((lang) => !('toolsMeta' in (shells[lang] ?? {})));
    expect(offenders).toEqual([]);
  });

  it('zh / en 之外的语言不在首屏同步列表里（否则首屏又会变大）', () => {
    expect([...SYNC_LANGS]).toEqual(['zh', 'en']);
  });
});
