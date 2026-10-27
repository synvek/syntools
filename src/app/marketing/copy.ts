import { useTranslation } from 'react-i18next';
import { normalizeLang } from '@/core/i18n';

/**
 * Locale resolution and copy lookup for the marketing and trust pages (pricing / security / privacy / about).
 *
 * Why these pages bypass `core/i18n/locales/*`:
 * the shell packs use `zh`'s keys as the type source, so a new section forces all 9 locales to be filled in,
 * or typecheck fails — and these 4 pages are sales material, so filling them in means a batch of MyMemory output.
 * `plan/Monetization.md` concluded "3 languages done well beats 9 done badly", so this matches
 * `/download`: hand-written zh / en / ja with other languages falling back to English.
 *
 * Traditional Chinese falls back to zh, not en: readable Simplified beats English.
 */

export type PageLang = 'zh' | 'en' | 'ja';

export function usePageLang(): PageLang {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en');
  if (lang === 'zh' || lang === 'zh-TW') return 'zh';
  if (lang === 'ja') return 'ja';
  return 'en';
}

/** Copy for one language; uncovered languages fall back to English (en is required) */
export function pickCopy<T>(dict: Partial<Record<PageLang, T>> & { en: T }, lang: PageLang): T {
  return dict[lang] ?? dict.en;
}

/**
 * Contact details.
 *
 * Buyers want "one email reaches a person", and GitHub issues are public, so they cannot carry quotes;
 * hence the real address from `VITE_CONTACT_EMAIL` takes priority, falling back to
 * GitHub's private channels (security advisories / Discussions) so the page never shows a
 * fake address that nobody reads.
 */
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ?? '';
export const HAS_CONTACT_EMAIL = CONTACT_EMAIL.length > 0;

const REPO_URL = 'https://github.com/synvek/syntools';

/** Entry point for quotes / procurement material */
export function inquiryHref(topic: string, body?: string): string {
  if (HAS_CONTACT_EMAIL) {
    const subject = encodeURIComponent(`[${topic}] SynTools 商务咨询`);
    const content = encodeURIComponent(body ?? '');
    return `mailto:${CONTACT_EMAIL}?subject=${subject}${content ? `&body=${content}` : ''}`;
  }
  // Without an email, fall back to GitHub Discussions: messages still arrive, contacts stay out of public issues
  return `${REPO_URL}/discussions/new?category=general`;
}

export const GITHUB_REPO_URL = REPO_URL;
export const GITHUB_RELEASES_URL = `${REPO_URL}/releases/latest`;
export const GITHUB_ISSUES_URL = `${REPO_URL}/issues`;

/**
 * Replace `{n}` placeholders in copy (the tool count changes with the registry, so it is never hard-coded).
 * Only placeholders present in the object are replaced; everything else stays as-is.
 */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
