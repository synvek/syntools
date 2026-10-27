import { useEffect, useMemo } from 'react';
import { Link } from '@/core/components/LocaleLink';
import { track } from '@/core/analytics';
import { GITHUB_REPO_URL, pickCopy, usePageLang, type PageLang } from '@/app/marketing/copy';
import { PageShell, Paragraphs, Section } from '@/app/marketing/ui';

/**
 * /privacy — the privacy notice.
 *
 * Deliberately short. A privacy page earns trust through specifics, not length: rather than reciting legal clauses,
 * it answers "do you ever see my files" once and clearly, and states the analytics scope up front.
 * Procurement and technical reviewers quote this page directly.
 */

interface PrivacyCopy {
  title: string;
  lead: string;
  sections: { title: string; body: string[] }[];
  footer: string;
  securityLink: string;
  revisionHistory: string;
}

const zh: PrivacyCopy = {
  title: '隐私说明',
  lead: '我们用「不做」来保护隐私，而不是用「承诺不用」。下面是完整的清单：哪些数据不存在，哪些存在本机，哪些可能被计数。',
  sections: [
    {
      title: '你的文件',
      body: [
        '不会被上传。网页版没有上传接口，文件在浏览器内存中处理并直接生成结果。你可以在开发者工具的 Network 面板里验证这一点：处理任意文件，全程没有出站请求。',
        '文件名、内容、处理结果都不进入任何日志。我们不运营任何接收文件的服务端。',
      ],
    },
    {
      title: '账号',
      body: ['不需要注册，也不提供账号系统。没有账号就没有「用户数据库」可以被泄露。'],
    },
    {
      title: '本机存储',
      body: [
        'localStorage 只保存四类东西：界面设置（主题、语言、侧边栏状态）、收藏与最近使用、未保存的草稿、以及首次访问的提示状态。',
        '这些数据留在你自己的浏览器里，可以随时通过清除站点数据删除。我们不读取、也不上传它们。',
      ],
    },
    {
      title: '统计埋点',
      body: [
        '本站网页版已启用，但采集端点与站点同源（/api/event），事件写入我们自己账号下的 Cloudflare Analytics Engine，不经过任何第三方统计服务。桌面版与离线部署包默认不启用。',
        '只上报事件名与计数用字段：打开工具、工具停留时长、工具报错、点击下载、搜索使用、页面浏览（首页 / 下载页 / 定价页 / 隐私 / 安全 / 关于）、点击询价。工具只报 id，搜索只报「查询长度 + 结果条数」，报错只报错误类型与去掉引号内容、文件名、数字后的摘要。',
        '不含输入内容、文件名、查询词、处理结果，也不含能跨站识别你的标识。',
        '不使用 Cookie，不做设备指纹。发送 DNT: 1 或 Global Privacy Control 时直接停止采集。会话标识是随机值，存在 sessionStorage 中，关闭标签页即失效。原始事件保留 3 个月，只以聚合形式查看（日活、工具排行、失败率），不做个体追踪。',
      ],
    },
    {
      title: '第三方',
      body: [
        '页面不加载任何第三方脚本、字体、图标库或统计服务。第三方分析在技术上无法运行 —— 站点的 CSP 把网络请求限制为同源。',
        '统计事件的存储使用 Cloudflare 的 Analytics Engine，作为基础设施服务商只保存上述聚合事件，不接触你的文件，也不做跨站画像。',
        '桌面版唯一的联网行为是检查更新（向 GitHub Releases 查询最新版本），可以在设置中关闭；关闭后没有任何出站请求。',
      ],
    },
    {
      title: '变更',
      body: [
        '这一页的每次修改都会以提交记录的形式留在公开仓库里，可追溯。若未来引入需要收集新数据的特性，会先改这一页，再上线功能。',
      ],
    },
  ],
  footer: '对本页内容有疑问，或需要一份可签署的数据处理声明，请联系我们。',
  securityLink: '查看安全与合规说明',
  revisionHistory: '本页修订历史',
};

const en: PrivacyCopy = {
  title: 'Privacy',
  lead: 'We protect privacy by not collecting, rather than by promising not to use. Here is the complete list: what does not exist, what stays on your machine, and what may be counted.',
  sections: [
    {
      title: 'Your files',
      body: [
        'Never uploaded. The web app has no upload endpoint; files are processed in browser memory and the result is produced locally. You can verify this in the Network panel: process any file and watch outbound requests stay at zero.',
        'File names, contents and results never reach a log. We do not operate any server that receives files.',
      ],
    },
    {
      title: 'Accounts',
      body: [
        'No signup and no account system. With no accounts there is no user database to leak.',
      ],
    },
    {
      title: 'Local storage',
      body: [
        'localStorage holds exactly four kinds of data: interface settings (theme, language, sidebar state), favourites and recent tools, unsaved drafts, and first-visit flags.',
        'It stays in your browser and can be removed at any time by clearing site data. We neither read it nor upload it.',
      ],
    },
    {
      title: 'Analytics',
      body: [
        'Enabled on this site, but the collector is same-origin (/api/event) and events land in a Cloudflare Analytics Engine dataset under our own account — no third-party analytics service is involved. The desktop build and offline packages do not enable it.',
        'Only event names and counting fields are reported: tool opened, tool dwell time, tool error, download clicked, search used, page view (home / download / pricing / privacy / security / about), inquiry clicked. Tools report an id, search reports query length plus result count, and errors report the error type plus a signature with quoted values, file names and digits removed.',
        'Never input content, file names, search terms or results, and nothing that could identify you across sites.',
        'No cookies, no device fingerprinting. If the browser sends DNT: 1 or Global Privacy Control, collection stops entirely. The session identifier is random, lives in sessionStorage and disappears when the tab closes. Raw events are kept for 3 months and read only in aggregate (daily actives, tool ranking, failure rate); no individual profiling.',
      ],
    },
    {
      title: 'Third parties',
      body: [
        'No third-party scripts, fonts, icon packs or analytics services are loaded. Third-party analytics cannot technically run: the Content-Security-Policy restricts network requests to the same origin.',
        'Event storage uses Cloudflare’s Analytics Engine as an infrastructure processor: it holds the aggregate events above, never touches your files, and builds no cross-site profile.',
        'The only outbound behaviour in the desktop build is an update check against GitHub Releases, which can be disabled; after that there are no outbound requests at all.',
      ],
    },
    {
      title: 'Changes',
      body: [
        'Every edit to this page is preserved as a commit in the public repository and is traceable. If a future feature needs new data, this page changes before the feature ships.',
      ],
    },
  ],
  footer: 'Questions about this page, or need a signable data-processing statement? Get in touch.',
  securityLink: 'Read the security & compliance notes',
  revisionHistory: 'Revision history for this page',
};

const ja: PrivacyCopy = {
  title: 'プライバシー',
  lead: '当サイトは「使わないと約束する」のではなく「集めない」ことでプライバシーを守ります。存在しないデータ、端末内に留まるデータ、計数されうるデータをすべて記載します。',
  sections: [
    {
      title: 'ファイルについて',
      body: [
        'アップロードされません。Web 版にアップロード用のエンドポイントはなく、ファイルはブラウザのメモリ内で処理され、結果も端末内で生成されます。開発者ツールの Network パネルで、任意のファイルを処理しても外向き通信がゼロのままであることを確認できます。',
        'ファイル名・内容・処理結果がログに残ることはありません。ファイルを受け取るサーバー自体を運用していません。',
      ],
    },
    {
      title: 'アカウント',
      body: [
        '登録は不要で、アカウント機能もありません。アカウントがなければ漏えいする利用者データベースも存在しません。',
      ],
    },
    {
      title: '端末内の保存',
      body: [
        'localStorage に保存するのは 4 種類だけです。画面設定（テーマ・言語・サイドバー状態）、お気に入りと最近使ったツール、未保存の下書き、初回訪問のフラグ。',
        'いずれもお使いのブラウザ内に留まり、サイトデータの削除でいつでも消せます。当方が読み取ったり送信したりすることはありません。',
      ],
    },
    {
      title: '計測',
      body: [
        '当サイトでは有効ですが、収集先は同一オリジン（/api/event）で、イベントは当方アカウントの Cloudflare Analytics Engine に書き込まれます。第三者の解析サービスは介しません。デスクトップ版とオフライン配布物では既定で無効です。',
        '送信するのはイベント名と計数用の項目のみ：ツール起動、滞在時間、エラー、ダウンロード、検索利用、ページ閲覧（ホーム／ダウンロード／料金／プライバシー／セキュリティ／概要）、問い合わせクリック。ツールは id、検索は「検索語の長さ＋結果件数」、エラーは種類と、引用符内・ファイル名・数字を除いた要約のみです。',
        '入力内容・ファイル名・検索語・処理結果は含まず、クロスサイトで識別できる情報も含みません。',
        'Cookie 不使用、端末指紋の取得なし。DNT: 1 または Global Privacy Control が有効なら収集を停止します。セッション識別子はランダム値で sessionStorage に保存され、タブを閉じると消えます。生イベントは 3 か月保管し、集計（日次利用者数・ツール別順位・失敗率）としてのみ参照します。',
      ],
    },
    {
      title: '第三者',
      body: [
        '第三者のスクリプト・フォント・アイコンライブラリ・解析サービスは一切読み込みません。CSP が通信を同一オリジンに限定しているため、第三者の解析は技術的に動作できません。',
        'イベントの保存には Cloudflare の Analytics Engine を基盤事業者として利用します。保管されるのは上記の集計イベントのみで、ファイルには触れず、クロスサイトのプロファイルも作りません。',
        'デスクトップ版で唯一の外向き通信はアップデート確認（GitHub Releases への問い合わせ）で、設定から無効化できます。無効化後は外向き通信は一切ありません。',
      ],
    },
    {
      title: '変更',
      body: [
        'このページの変更はすべて公開リポジトリのコミットとして残り、追跡できます。将来新しいデータが必要な機能を追加する場合は、機能の公開前にこのページを更新します。',
      ],
    },
  ],
  footer:
    '本ページについてのご質問、または署名可能なデータ処理に関する表明が必要な場合はご連絡ください。',
  securityLink: 'セキュリティとコンプライアンスの説明を読む',
  revisionHistory: 'このページの改訂履歴',
};

const copyDict: Partial<Record<PageLang, PrivacyCopy>> & { en: PrivacyCopy } = { zh, en, ja };

export function PrivacyPage() {
  const lang = usePageLang();
  const c = useMemo(() => pickCopy(copyDict, lang), [lang]);

  useEffect(() => {
    track('page_view', { page: 'privacy' });
  }, [lang]);

  return (
    <PageShell title={c.title} lead={c.lead}>
      {c.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          <Paragraphs items={section.body} />
        </Section>
      ))}

      <p className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {c.footer}{' '}
        <Link
          to="/security"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {c.securityLink}
        </Link>
      </p>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        <a
          href={`${GITHUB_REPO_URL}/commits/main`}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {c.revisionHistory}
        </a>
      </p>
    </PageShell>
  );
}
