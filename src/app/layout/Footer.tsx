import type { ReactNode } from 'react';
import { Link } from '@/core/components/LocaleLink';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL, pickCopy, usePageLang } from '@/app/marketing/copy';
import type { PageLang } from '@/app/marketing/copy';

/**
 * Global footer.
 *
 * Why it exists: `plan/Monetization.md` recorded that the site had no download page,
 * no pricing and no trust pages, so the user path died at the home page. The footer is their only permanent entry —
 * the home page has 153 tool cards and tool pages are editors; neither should host sales links.
 *
 * Two constraints:
 * 1. **Never rendered on tool pages**: they (especially the photo editor and slides) lay out to the leftover first-screen height,
 *    and an extra bottom row squeezes the canvas for no benefit. AppLayout decides after checking the route.
 * 2. **Copy bypasses the 9-language packs**: it uses the same zh / en / ja dictionary as /pricing,
 *    with other languages falling back to English, avoiding another batch of machine translation.
 */

interface FooterCopy {
  tagline: string;
  productTitle: string;
  trustTitle: string;
  communityTitle: string;
  allTools: string;
  download: string;
  pricing: string;
  security: string;
  privacy: string;
  about: string;
  issues: string;
  source: string;
  license: string;
}

const zh: FooterCopy = {
  tagline: '数据不上传，处理在本机完成。',
  productTitle: '产品',
  trustTitle: '信任',
  communityTitle: '社区',
  allTools: '全部工具',
  download: '下载桌面版',
  pricing: '定价与授权',
  security: '安全与合规',
  privacy: '隐私说明',
  about: '关于',
  issues: '反馈问题',
  source: '源码',
  license: 'AGPL-3.0-only',
};

const en: FooterCopy = {
  tagline: 'Nothing is uploaded — processing stays on your machine.',
  productTitle: 'Product',
  trustTitle: 'Trust',
  communityTitle: 'Community',
  allTools: 'All tools',
  download: 'Download desktop',
  pricing: 'Pricing',
  security: 'Security',
  privacy: 'Privacy',
  about: 'About',
  issues: 'Issues',
  source: 'Source',
  license: 'AGPL-3.0-only',
};

const ja: FooterCopy = {
  tagline: 'アップロードは行いません。処理は端末内で完結します。',
  productTitle: 'プロダクト',
  trustTitle: '信頼',
  communityTitle: 'コミュニティ',
  allTools: 'すべてのツール',
  download: 'デスクトップ版',
  pricing: '料金',
  security: 'セキュリティ',
  privacy: 'プライバシー',
  about: '概要',
  issues: '問題を報告',
  source: 'ソース',
  license: 'AGPL-3.0-only',
};

const copyDict: Partial<Record<PageLang, FooterCopy>> & { en: FooterCopy } = { zh, en, ja };

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">{children}</ul>
    </div>
  );
}

const linkClass =
  'text-gray-600 hover:text-blue-600 hover:underline dark:text-gray-400 dark:hover:text-blue-400';

export function Footer() {
  const lang = usePageLang();
  const c = pickCopy(copyDict, lang);

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white px-6 py-8 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <p className="flex items-center gap-2 text-sm font-bold">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
            />
            SynTools
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {c.tagline}
          </p>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            {c.license} · v{__APP_VERSION__}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <Column title={c.productTitle}>
            <li>
              <Link to="/" className={linkClass}>
                {c.allTools}
              </Link>
            </li>
            <li>
              <Link to="/download" className={linkClass}>
                {c.download}
              </Link>
            </li>
            <li>
              <Link to="/pricing" className={linkClass}>
                {c.pricing}
              </Link>
            </li>
          </Column>
          <Column title={c.trustTitle}>
            <li>
              <Link to="/security" className={linkClass}>
                {c.security}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={linkClass}>
                {c.privacy}
              </Link>
            </li>
            <li>
              <Link to="/about" className={linkClass}>
                {c.about}
              </Link>
            </li>
          </Column>
          <Column title={c.communityTitle}>
            <li>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className={linkClass}>
                {c.source}
              </a>
            </li>
            <li>
              <a href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer" className={linkClass}>
                {c.issues}
              </a>
            </li>
          </Column>
        </div>
      </div>
    </footer>
  );
}
