import { useTranslation } from 'react-i18next';
import { normalizeLang } from '@/core/i18n';

/**
 * 营销与信任页（定价 / 安全 / 隐私 / 关于）的语言解析与文案取值。
 *
 * 为什么不接 `core/i18n/locales/*`：
 * 外壳语言包以 `zh` 的键结构作为类型源，新增 section 会强制 9 个语种同步补齐，
 * 否则 typecheck 失败 —— 而这 4 页是销售材料，一旦补齐就意味着一批 MyMemory 机翻。
 * `plan/Monetization.md` 的结论是「宁可 3 语精，不要 9 语糙」，所以这里与
 * `/download` 页保持一致：人工撰写 zh / en / ja，其余语种回落英文。
 *
 * 繁体按「能读简体胜过读英文」处理，回落 zh 而不是 en。
 */

export type PageLang = 'zh' | 'en' | 'ja';

export function usePageLang(): PageLang {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en');
  if (lang === 'zh' || lang === 'zh-TW') return 'zh';
  if (lang === 'ja') return 'ja';
  return 'en';
}

/** 取某一语言的文案；未覆盖的语种回落英文（en 为必填） */
export function pickCopy<T>(dict: Partial<Record<PageLang, T>> & { en: T }, lang: PageLang): T {
  return dict[lang] ?? dict.en;
}

/**
 * 联系方式。
 *
 * 采购方要的是「发一封信就能对上人」，而 GitHub Issue 是公开的，不能用于报价；
 * 因此优先用 `VITE_CONTACT_EMAIL` 配置的真实邮箱，未配置时降级到
 * GitHub 的私有渠道（Security advisory / Discussions），避免页面上出现一个
 * 收不到信的假地址。
 */
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ?? '';
export const HAS_CONTACT_EMAIL = CONTACT_EMAIL.length > 0;

const REPO_URL = 'https://github.com/synvek/syntools';

/** 询价 / 索取采购材料的入口 */
export function inquiryHref(topic: string, body?: string): string {
  if (HAS_CONTACT_EMAIL) {
    const subject = encodeURIComponent(`[${topic}] SynTools 商务咨询`);
    const content = encodeURIComponent(body ?? '');
    return `mailto:${CONTACT_EMAIL}?subject=${subject}${content ? `&body=${content}` : ''}`;
  }
  // 无邮箱时退到 GitHub 讨论区：仍然能收到消息，但不会把联系方式暴露在公开 issue 里
  return `${REPO_URL}/discussions/new?category=general`;
}

export const GITHUB_REPO_URL = REPO_URL;
export const GITHUB_RELEASES_URL = `${REPO_URL}/releases/latest`;
export const GITHUB_ISSUES_URL = `${REPO_URL}/issues`;

/**
 * 文案里的 `{n}` 占位替换（工具数量会随注册表变化，不写死在文案里）。
 * 只替换对象里出现的占位符，其余原样保留。
 */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
