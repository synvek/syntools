import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { track } from '@/core/analytics';
import { tools } from '@/core/registry';
import { Icon } from '@/core/components/Icon';
import {
  fill,
  GITHUB_REPO_URL,
  inquiryHref,
  pickCopy,
  usePageLang,
  type PageLang,
} from '@/app/marketing/copy';
import { FaqList, PageShell, PriceCard, Section, NoteBar } from '@/app/marketing/ui';
import type { PriceTier } from '@/app/marketing/ui';

/**
 * /pricing —— 定价页。
 *
 * 产品结构是「形态 × 许可」，两条线共五个入口：
 *   - 网页版（免费）
 *   - 桌面端：社区版（免费，AGPL-3.0） / 专业版（规划中）
 *   - 服务器端：社区服务器版（免费，AGPL-3.0） / 企业服务器版（规划中）
 *
 * 四条刻意的取舍：
 * 1. **免费档不设功能墙**。社区版与网页版给的是一整套工具，不加水印、不降精度、
 *    不拿「升级解锁」当增长手段 —— 工具站用户对阉割极度敏感。
 * 2. **付费档不报价、不编差异**。两个付费档的功能范围、授权方式与价格都还在规划中，
 *    此时写任何数字或差异表都是在透支信任；页面只留「规划中 + 登记」。
 * 3. **不拿签名、公证当卖点**。所有构建都会签名，它属于发布流程的必备项而不是产品差异，
 *    因此不出现在任何一档的描述里。
 * 4. **不假装能立刻付款**。付费档未开放，CTA 是登记与咨询，不是点了没反应的购买按钮。
 */

type TierKey = 'web' | 'desktopCommunity' | 'desktopPro' | 'serverCommunity' | 'serverEnterprise';

interface TierCopy {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  bullets: string[];
  ctaLabel: string;
  note?: string;
  badge?: string;
}

interface PricingCopy {
  title: string;
  lead: string;
  topNote: string;
  tiers: Record<TierKey, TierCopy>;
  groupDesktop: string;
  groupDesktopHint: string;
  groupServer: string;
  groupServerHint: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  contactTitle: string;
  contactBody: string;
  contactCta: string;
  contactHint: string;
  safeTitle: string;
  safeBody: string;
  seeSecurity: string;
}

const zh: PricingCopy = {
  title: '定价',
  lead: '网页版全部工具永久免费。桌面版与服务器版各有一个免费的社区版，按 AGPL-3.0 提供，工具一个不少。桌面专业版与企业服务器版仍在规划中 —— 价格、功能范围与授权方式确定后会在这里公布。',
  topNote: '没有广告、没有弹窗、没有「下载前请等待 30 秒」，也不要求注册账号。',
  tiers: {
    web: {
      name: '网页版',
      price: '¥0',
      unit: '永久免费',
      tagline: '打开就能用，不装任何东西',
      bullets: [
        '全部 {n} 个工具，不限次数',
        '单文件处理无限制，不降精度、不加水印',
        '无需注册、无需安装、无需登录',
        '文件在浏览器内存中处理，不上传',
      ],
      ctaLabel: '立即使用',
      note: '受浏览器标签页内存限制：处理几百 MB 的 PDF 或长视频时可能变慢或失败。',
    },
    desktopCommunity: {
      name: '桌面社区版',
      price: '¥0',
      unit: 'AGPL-3.0 · 永久免费',
      tagline: '同一套界面，全功能离线运行',
      bullets: [
        '没有标签页内存上限，大文件不再中途崩溃',
        '完全离线：断网、内网、出差路上都能跑',
        '直接读写本地目录，批量处理更顺手',
        '以 AGPL-3.0 提供，源码公开，可自行构建与改动',
      ],
      ctaLabel: '获取社区版',
      badge: '现在可用',
      note: '改过之后再对外分发，需要一并公开源码；纯内部自用不受此限制。',
    },
    desktopPro: {
      name: '桌面专业版',
      price: '规划中',
      unit: '价格与授权范围待定',
      tagline: '在社区版之外，提供商业许可与更完整的能力',
      bullets: [
        '商业许可：可在闭源环境使用、可嵌入自有产品',
        '功能范围仍在规划中，确定后在这里公布',
        '社区版继续免费提供全部现有工具，不受影响',
      ],
      ctaLabel: '登记，第一时间获知',
      note: '还没有价格可填，也不会先编一个数字。确定后在本页与邮件里公布。',
    },
    serverCommunity: {
      name: '社区服务器版',
      price: '¥0',
      unit: 'AGPL-3.0 · 永久免费',
      tagline: '放到自己的机器上，一个工具都不少',
      bullets: [
        'docker-compose 一键起，或解压后交给任意静态服务器',
        '无外部请求：不联网激活、不上报用量、不查版本',
        '与网页版同一份构建产物：不需要数据库，也没有服务端进程',
        '以 AGPL-3.0 提供，可自由修改与二次开发',
      ],
      ctaLabel: '从源码部署',
      note: '把修改后的版本作为对外服务提供时，需公开修改部分的源码；纯内部自用不会触发。',
    },
    serverEnterprise: {
      name: '企业服务器版',
      price: '规划中',
      unit: '授权方式与价格待定',
      tagline: '给禁止外传文件的单位用',
      bullets: [
        '离线部署包：静态站点 + docker-compose + nginx 示例，无外网依赖',
        '商业许可：免除 AGPL 对外开源义务，可闭源集成',
        '授权方式与维保条款仍在规划中，确定后一并公布',
        '安全说明、采购应答材料与合同条款可按贵方模板协商',
      ],
      ctaLabel: '登记与咨询',
      note: '可以先做技术交流和材料预审，价格随方案一起给出。',
    },
  },
  groupDesktop: '桌面端',
  groupDesktopHint: '同一套界面，在本机全功能离线运行',
  groupServer: '服务器端',
  groupServerHint: '部署在你自己控制的机器或内网里，不经过我们的服务器',
  faqTitle: '常见问题',
  faq: [
    {
      q: '这么多版本都免费，项目靠什么持续？',
      a: '靠商业许可。桌面专业版与企业服务器版是计划中的收入来源，两个档位仍在规划中，暂时不公布价格。在它们定下来之前，免费档不是试用版，也没有到期时间。',
    },
    {
      q: '桌面专业版和企业服务器版现在能买吗？',
      a: '还不能。价格、功能范围与授权方式都还在规划，与其先给一个会变的数字，不如定下来再报。可以登记联系方式，确定后第一时间通知。',
    },
    {
      q: '商业许可和 AGPL-3.0 是什么关系？',
      a: '本项目以 AGPL-3.0 开源。AGPL 要求「通过网络对外提供服务时也要提供源码」，不少企业法务因此禁止 AGPL 组件入库。商业许可用于免除这项义务；具体授权范围会随付费档一起确定。',
    },
    {
      q: '企业服务器版会交付什么？',
      a: '现在能确定的是离线部署包：静态站点、docker-compose、nginx 示例配置，放到任意静态服务器就能跑，全程不需要外网。授权方式与维保条款属于规划中的部分，确定后再写成条款。',
    },
    {
      q: '能开票、能签合同吗？',
      a: '可以走对公转账并开具增值税发票。保密协议、采购合同、安全承诺函都可以按贵方模板签署；需要技术评审材料时，可先提供部署拓扑、组件清单与依赖许可清单。',
    },
  ],
  contactTitle: '需要报价单或采购材料？',
  contactBody:
    '告诉我们单位性质（政企 / 金融 / 医疗 / 制造 / 其它）、终端点数与是否需要内网隔离。付费档的价格仍在规划中，但部署形态、交付物与合同条款可以先对。',
  contactCta: '发起商务咨询',
  contactHint: '通常 1 个工作日内回复。技术问题建议直接提 Issue，响应更快。',
  safeTitle: '数据不出内网，这一点可被验证',
  safeBody:
    '站点的内容安全策略把出站请求限制为同源（connect-src ' +
    "'self'），第三方统计与分析脚本在物理上无法工作；源码公开、可离线构建、可自行审计。",
  seeSecurity: '查看安全与合规说明',
};

const en: PricingCopy = {
  title: 'Pricing',
  lead: 'Every tool in the web app is free, forever. The desktop and server lines each have a free community edition under AGPL-3.0, with no feature walls. Desktop Pro and Enterprise Server are still being planned — pricing, scope and licensing will be published here once settled.',
  topNote:
    'No ads, no interstitials, no "wait 30 seconds before downloading", no account required.',
  tiers: {
    web: {
      name: 'Web app',
      price: '$0',
      unit: 'free forever',
      tagline: 'Open a tab and go',
      bullets: [
        'All {n} tools, unlimited use',
        'Unlimited single-file processing — no downgrades, no watermarks',
        'No signup, no install, no login',
        'Files are processed in browser memory and never uploaded',
      ],
      ctaLabel: 'Start using it',
      note: 'Bounded by the browser tab: very large PDFs or long videos may slow down or fail.',
    },
    desktopCommunity: {
      name: 'Desktop Community',
      price: '$0',
      unit: 'AGPL-3.0 · free forever',
      tagline: 'The same UI, fully offline',
      bullets: [
        'No tab memory ceiling — large files stop crashing halfway',
        'Fully offline: planes, intranets, air-gapped machines',
        'Direct local folder access, far better for batch work',
        'AGPL-3.0 with public source — build and modify it yourself',
      ],
      ctaLabel: 'Get the community build',
      badge: 'Available now',
      note: 'If you redistribute a modified version, publish your changes; internal use alone does not require it.',
    },
    desktopPro: {
      name: 'Desktop Pro',
      price: 'TBA',
      unit: 'pricing and licence scope pending',
      tagline: 'A commercial licence and a wider scope, beyond the community edition',
      bullets: [
        'Commercial licence: closed-source use, embeddable in your own product',
        'Feature scope is still being planned and will be listed here',
        'The community edition keeps every current tool, unaffected',
      ],
      ctaLabel: 'Register for updates',
      note: 'There is no price to show yet, and we will not invent one. It will be published here and by email once settled.',
    },
    serverCommunity: {
      name: 'Community Server',
      price: '$0',
      unit: 'AGPL-3.0 · free forever',
      tagline: 'Put it on any box you control. Nothing is held back.',
      bullets: [
        'One docker-compose up, or unzip and serve from any static host',
        'No outbound calls: no activation, no usage reporting, no version check',
        'Same build as the web app — no database, no server-side process',
        'AGPL-3.0: modify and extend it freely',
      ],
      ctaLabel: 'Deploy from source',
      note: 'Serving a modified build to others means publishing those changes; internal use alone does not.',
    },
    serverEnterprise: {
      name: 'Enterprise Server',
      price: 'TBA',
      unit: 'licensing and price pending',
      tagline: 'For organisations that forbid external uploads',
      bullets: [
        'Offline bundle: static site + docker-compose + nginx samples, no outbound dependency',
        'Commercial licence removing AGPL obligations; closed-source integration allowed',
        'Licensing model and maintenance terms are still being planned',
        'Security notes, procurement pack and contract terms negotiable on your template',
      ],
      ctaLabel: 'Register and talk to us',
      note: 'We can start with a technical review and a document pre-check; pricing comes with the proposal.',
    },
  },
  groupDesktop: 'Desktop',
  groupDesktopHint: 'The same UI, running fully offline on your own machine',
  groupServer: 'Server',
  groupServerHint: 'Deployed on hardware you control — never proxied through us',
  faqTitle: 'Questions',
  faq: [
    {
      q: 'If so much is free, how does this sustain itself?',
      a: 'Through commercial licences. Desktop Pro and Enterprise Server are the intended revenue line, and both are still being scoped, so there is no price to publish yet. Until they are settled, the free editions are not trials and have no expiry.',
    },
    {
      q: 'Can I buy Desktop Pro or Enterprise Server today?',
      a: 'Not yet. Pricing, feature scope and licensing are still being planned, and we would rather publish nothing than publish a number that changes. Register and we will tell you first.',
    },
    {
      q: 'How does the commercial licence relate to AGPL-3.0?',
      a: 'The project is AGPL-3.0. AGPL requires source disclosure when you offer the software as a network service, which is why many legal teams block AGPL components. A commercial licence removes that obligation; its exact scope will be settled together with the paid tiers.',
    },
    {
      q: 'What will Enterprise Server deliver?',
      a: 'What we can commit to today is the offline bundle: the static site, docker-compose and a sample nginx config — serve it from any static host, with no outbound network at any point. The licence model and maintenance terms belong to the planning work and will be documented once decided.',
    },
    {
      q: 'Can you invoice and sign a contract?',
      a: 'Yes — bank transfer with a proper invoice. NDAs, procurement contracts and security letters can be signed on your template. For technical review we can supply the deployment topology, component inventory and dependency licence list.',
    },
  ],
  contactTitle: 'Need a quote or procurement pack?',
  contactBody:
    'Tell us your organisation type, seat count and whether the deployment must be air-gapped. Pricing for the paid tiers is still being planned, but the deployment shape, deliverables and contract terms can be agreed first.',
  contactCta: 'Start a conversation',
  contactHint:
    'Usually answered within one business day. For technical issues, a GitHub Issue is faster.',
  safeTitle: 'The no-egress claim is verifiable',
  safeBody:
    "The site's Content-Security-Policy limits outbound requests to the same origin (connect-src 'self'), so third-party analytics cannot physically run. Source is public, builds are reproducible offline, and the whole thing is auditable.",
  seeSecurity: 'Read the security & compliance notes',
};

const ja: PricingCopy = {
  title: '料金',
  lead: 'Web 版のすべてのツールは永久無料です。デスクトップ版とサーバー版には、いずれも AGPL-3.0 の無料コミュニティ版があり、機能制限はありません。デスクトップ プロ版とエンタープライズ サーバー版は企画中で、価格・機能範囲・ライセンスは確定次第このページで公開します。',
  topNote:
    '広告なし、ポップアップなし、「ダウンロードまで 30 秒お待ちください」もなし。アカウント登録も不要です。',
  tiers: {
    web: {
      name: 'Web 版',
      price: '¥0',
      unit: '永久無料',
      tagline: '開くだけですぐ使える',
      bullets: [
        '全 {n} ツールを回数制限なしで利用',
        '単一ファイルの処理は無制限（画質劣化・透かしなし）',
        '登録・インストール・ログイン不要',
        'ファイルはブラウザのメモリ内で処理され、送信されません',
      ],
      ctaLabel: '今すぐ使う',
      note: 'ブラウザのタブメモリ上限の影響を受けます。数百 MB の PDF や長い動画では遅くなる／失敗することがあります。',
    },
    desktopCommunity: {
      name: 'デスクトップ コミュニティ版',
      price: '¥0',
      unit: 'AGPL-3.0・永久無料',
      tagline: '同じ画面を、完全オフラインで',
      bullets: [
        'タブのメモリ上限なし。大きなファイルでも途中で落ちない',
        '完全オフライン。機内・社内ネットワーク・遮断環境でも動作',
        'ローカルフォルダーを直接読み書きでき、一括処理が快適',
        'AGPL-3.0 でソース公開。ご自身でビルド・改変できます',
      ],
      ctaLabel: 'コミュニティ版を入手',
      badge: '提供中',
      note: '改変版を再配布する場合はソース公開が必要です。純粋な社内利用では発生しません。',
    },
    desktopPro: {
      name: 'デスクトップ プロ版',
      price: '企画中',
      unit: '価格・ライセンス範囲は未定',
      tagline: 'コミュニティ版に加えて、商用ライセンスとより広い範囲を',
      bullets: [
        '商用ライセンス：クローズド利用・自社製品への組み込みが可能',
        '機能範囲は企画中で、確定後に本ページで公開します',
        'コミュニティ版は現行の全ツールを無料のまま提供します',
      ],
      ctaLabel: '登録して通知を受け取る',
      note: '提示できる価格はまだありません。数字を先に作らず、確定後に本ページとメールでお知らせします。',
    },
    serverCommunity: {
      name: 'コミュニティ サーバー版',
      price: '¥0',
      unit: 'AGPL-3.0・永久無料',
      tagline: '自分のマシンに置くだけ。機能制限はありません',
      bullets: [
        'docker-compose 一発、または解凍して任意の静的サーバーに配置',
        '外部通信なし。認証・利用量の送信・バージョン確認も行いません',
        'Web 版と同一のビルド。データベースもサーバー側プロセスも不要',
        'AGPL-3.0。自由に改変・拡張できます',
      ],
      ctaLabel: 'ソースから導入',
      note: '改変版をネットワークサービスとして提供する場合は改変部分のソース公開が必要です。純粋な社内利用では発生しません。',
    },
    serverEnterprise: {
      name: 'エンタープライズ サーバー版',
      price: '企画中',
      unit: 'ライセンス方式と価格は未定',
      tagline: '外部送信が禁止されている組織向け',
      bullets: [
        'オフライン配布物：静的サイト + docker-compose + nginx 設定例。外部依存なし',
        '商用ライセンス：AGPL のソース開示義務を免除し、クローズド統合も可能',
        'オフラインライセンス方式と保守条件は企画中',
        'セキュリティ説明・調達資料・契約条件は貴社の雛形で相談可能',
      ],
      ctaLabel: '登録・ご相談',
      note: 'まず技術的なやり取りと資料の事前確認から。価格はご提案と併せて提示します。',
    },
  },
  groupDesktop: 'デスクトップ版',
  groupDesktopHint: '同じ画面を、手元のマシンで完全オフライン稼働',
  groupServer: 'サーバー版',
  groupServerHint: '自社で管理するマシンや社内ネットワークに設置。当社サーバーを経由しません',
  faqTitle: 'よくある質問',
  faq: [
    {
      q: 'これだけ無料だと、どうやって維持していますか？',
      a: '商用ライセンスです。デスクトップ プロ版とエンタープライズ サーバー版が収益源の予定で、いずれも企画中のため価格はまだ提示できません。確定するまで、無料版は試用版ではなく期限もありません。',
    },
    {
      q: 'デスクトップ プロ版・エンタープライズ サーバー版は今買えますか？',
      a: 'まだです。価格・機能範囲・ライセンスはすべて企画中で、変わる数字を先に出すより、確定してから提示したいと考えています。ご登録いただければ確定時に優先してご案内します。',
    },
    {
      q: '商用ライセンスと AGPL-3.0 の関係は？',
      a: '本プロジェクトは AGPL-3.0 で公開しています。AGPL はネットワーク経由で提供する場合にもソース開示を求めるため、多くの法務部門が AGPL コンポーネントを禁止しています。商用ライセンスはこの義務を免除するもので、具体的な範囲は有料版と併せて確定します。',
    },
    {
      q: 'エンタープライズ サーバー版の納品物は？',
      a: '現時点で確約できるのはオフライン配布物です。静的サイト、docker-compose、nginx の設定例が入り、任意の静的サーバーに置くだけで動作、外部ネットワークは一切不要です。ライセンス方式と保守条件は企画中の部分で、確定後に条項として明記します。',
    },
    {
      q: '請求書の発行や契約は可能ですか？',
      a: '可能です。銀行振込と請求書に対応します。秘密保持契約・調達契約・セキュリティ確認書は貴社の雛形での締結も承ります。技術審査向けに構成図、コンポーネント一覧、依存ライセンス一覧も提出できます。',
    },
  ],
  contactTitle: '見積書や調達資料が必要ですか？',
  contactBody:
    '組織の種類（官公庁・金融・医療・製造・その他）、端末数、社内ネットワーク分離の要否をお知らせください。有料版の価格は企画中ですが、導入形態・納品物・契約条件は先にすり合わせできます。',
  contactCta: '商談を申し込む',
  contactHint:
    '通常 1 営業日以内に返信します。技術的なご質問は GitHub Issue のほうが早い場合があります。',
  safeTitle: '「外部送信なし」は検証できます',
  safeBody:
    'サイトの Content-Security-Policy は外部への通信を同一オリジン（connect-src ' +
    "'self'）に限定しているため、第三者の解析スクリプトは物理的に動作できません。ソースは公開され、オフラインでビルド・監査できます。",
  seeSecurity: 'セキュリティとコンプライアンスの説明を読む',
};

const copyDict: Partial<Record<PageLang, PricingCopy>> & { en: PricingCopy } = { zh, en, ja };

export function PricingPage() {
  const lang = usePageLang();
  const c = useMemo(() => pickCopy(copyDict, lang), [lang]);
  const n = tools.length;
  const vars = useMemo(() => ({ n }), [n]);

  useEffect(() => {
    document.title = `${c.title} · SynTools`;
    track('pricing_view', { lng: lang });
  }, [c.title, lang]);

  const toTier = useMemo(
    () =>
      (tier: TierCopy, cta: PriceTier['cta'], extra?: Partial<PriceTier>): PriceTier => ({
        ...tier,
        tagline: fill(tier.tagline, vars),
        bullets: tier.bullets.map((b) => fill(b, vars)),
        note: tier.note ? fill(tier.note, vars) : undefined,
        cta,
        ...extra,
      }),
    [vars],
  );

  const web = toTier(c.tiers.web, { label: c.tiers.web.ctaLabel, href: '/' });
  const desktop = [
    toTier(
      c.tiers.desktopCommunity,
      { label: c.tiers.desktopCommunity.ctaLabel, href: '/download' },
      { highlight: true },
    ),
    toTier(c.tiers.desktopPro, {
      label: c.tiers.desktopPro.ctaLabel,
      href: inquiryHref('desktop-pro'),
      external: true,
    }),
  ];
  const server = [
    toTier(c.tiers.serverCommunity, {
      label: c.tiers.serverCommunity.ctaLabel,
      href: GITHUB_REPO_URL,
      external: true,
    }),
    toTier(c.tiers.serverEnterprise, {
      label: c.tiers.serverEnterprise.ctaLabel,
      href: inquiryHref('server-enterprise'),
      external: true,
    }),
  ];

  return (
    <PageShell wide title={c.title} lead={c.lead}>
      <p className="text-xs text-gray-400 dark:text-gray-500">{c.topNote}</p>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{web.name}</h3>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {web.unit}
            </span>
          </div>
          <p>
            <span className="text-2xl font-bold tracking-tight">{web.price}</span>
          </p>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{web.tagline}</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {web.bullets.map((item) => (
            <p
              key={item}
              className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300"
            >
              <Icon
                name="check"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <span>{item}</span>
            </p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {web.note && (
            <p className="max-w-xl text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              {web.note}
            </p>
          )}
          <Link
            to="/"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            {web.cta.label}
          </Link>
        </div>
      </div>

      <Section title={c.groupDesktop}>
        <p className="-mt-1 mb-3 text-xs text-gray-400 dark:text-gray-500">{c.groupDesktopHint}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {desktop.map((tier) => (
            <PriceCard key={tier.name} tier={tier} />
          ))}
        </div>
      </Section>

      <Section title={c.groupServer}>
        <p className="-mt-1 mb-3 text-xs text-gray-400 dark:text-gray-500">{c.groupServerHint}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {server.map((tier) => (
            <PriceCard key={tier.name} tier={tier} />
          ))}
        </div>
      </Section>

      <Section title={c.faqTitle}>
        <FaqList items={c.faq} />
      </Section>

      <Section title={c.contactTitle}>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {c.contactBody}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={inquiryHref('server-enterprise')}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('inquiry_click', { from: 'pricing', tier: 'server-enterprise' })}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {c.contactCta}
            </a>
            <Link
              to="/download"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {c.tiers.desktopCommunity.ctaLabel}
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{c.contactHint}</p>
        </div>
      </Section>

      <Section title={c.safeTitle}>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{c.safeBody}</p>
        <NoteBar>
          <Link to="/security" className="font-medium underline">
            {c.seeSecurity}
          </Link>
        </NoteBar>
      </Section>
    </PageShell>
  );
}
