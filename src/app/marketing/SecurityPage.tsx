import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { track } from '@/core/analytics';
import {
  GITHUB_REPO_URL,
  inquiryHref,
  pickCopy,
  usePageLang,
  type PageLang,
} from '@/app/marketing/copy';
import {
  DefinitionList,
  FaqList,
  NoteBar,
  PageShell,
  Paragraphs,
  Section,
  CheckList,
} from '@/app/marketing/ui';

/**
 * /security —— 安全与合规说明。
 *
 * 这是「企业内网私有部署」这条主赛道能不能过技术评审的决定性材料，
 * 也是唯一别人难复制的差异点：纯静态、无外联、CSP 极严、代码可审计。
 *
 * 写作原则：**只写能当场验证的事**，每条都给出验证方式（开发者工具、仓库文件路径、
 * 依赖清单）。同时把站上真实的例外（内联样式、检查更新、可选埋点）主动写出来 ——
 * 一份只讲优点不讲例外的安全说明，在评审会上第一轮就会被问穿。
 */

interface SecurityCopy {
  title: string;
  lead: string;
  dataTitle: string;
  dataItems: string[];
  cspTitle: string;
  cspLead: string;
  cspItems: { term: string; desc: string }[];
  cspLinkLabel: string;
  cspCaveat: string;
  thirdTitle: string;
  thirdItems: string[];
  auditTitle: string;
  auditItems: string[];
  licenseTitle: string;
  licenseItems: string[];
  deployTitle: string;
  deployItems: string[];
  disclosureTitle: string;
  disclosureLead: string;
  disclosureItems: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
  ctaSecondary: string;
}

const zh: SecurityCopy = {
  title: '安全与合规',
  lead: '「数据不出浏览器」在这里不是一个口号，而是可以被逐条验证的技术事实。',
  dataTitle: '数据在哪里处理',
  dataItems: [
    '网页版没有上传接口。文件通过浏览器原生的文件选择或拖放进入页面内存，由 Canvas、WebAssembly 与 JavaScript 在本机完成解析、处理和导出。',
    '全站唯一必需的网络请求是加载页面自身的静态资源（HTML / JS / CSS / WASM）。处理文件的过程中不会产生任何出站请求。',
    '验证方式：打开开发者工具的 Network 面板，勾选保留日志，处理任意一个 PDF 或图片，观察 XHR / Fetch / WebSocket 全程为零。',
  ],
  cspTitle: '内容安全策略（CSP）',
  cspLead: '站点通过响应头下发 CSP，由浏览器强制执行。它不只是「声明」，而是每条都实际拦截的规则：',
  cspItems: [
    { term: "default-src 'self'", desc: '默认只允许本站资源，任何外部域的资源都会被拒绝加载。' },
    {
      term: "connect-src 'self' data: blob:",
      desc: '网络请求只能回到本站域名。第三方统计、行为分析、A/B 测试脚本在物理上无法工作 —— 这也是本站不使用它们的原因。',
    },
    {
      term: "script-src 'self' 'wasm-unsafe-eval'",
      desc: '禁止内联脚本与 CDN 脚本；wasm-unsafe-eval 仅用于编译音视频处理用的 WebAssembly（ffmpeg.wasm）。',
    },
    {
      term: "img-src 'self' data: blob:",
      desc: '图片来源限定为本站、内联 data URL 与本地 blob（工具预览用）。',
    },
    {
      term: "worker-src 'self' blob:",
      desc: '允许把本地脚本包装成 Worker 使用，不允许从外部加载 Worker。',
    },
    {
      term: 'frame-ancestors none',
      desc: '本站页面不允许被任何站点用 iframe 嵌套，杜绝点击劫持套壳。',
    },
    {
      term: 'object-src none',
      desc: '禁用所有浏览器插件（Flash 时代的攻击面），页面里不能插入 object/embed。',
    },
    {
      term: "form-action 'self'",
      desc: '表单只能提交回本站，不会被劫持到第三方地址。',
    },
  ],
  cspLinkLabel: '在仓库中查看完整策略（public/_headers 与 vercel.json）',
  cspCaveat:
    '如实说明一处放宽：style-src 包含 unsafe-inline。编辑器的主题色、面板尺寸、画布变换需要动态写内联样式，这是纯展示层的能力，不允许执行脚本。',
  thirdTitle: '没有第三方运行时依赖',
  thirdItems: [
    '页面不加载任何 CDN 上的脚本、样式、字体或图标库：字体使用系统字体栈，图标是内联 SVG，编辑器与编解码库全部随构建产物同源分发。',
    '不使用 Cookie 做追踪，不加载任何追踪像素或信标（beacon），因此不存在第三方跨站画像的可能。',
  ],
  auditTitle: '可以自己审计，不必相信我们',
  auditItems: [
    '源码以 AGPL-3.0 公开在 GitHub，任何人都可以克隆、审阅、构建。',
    '构建产物可离线运行：pnpm install && pnpm build 之后，把 dist/ 放到任意静态服务器，断网即可使用全部工具。',
    '依赖清单锁定在 pnpm-lock.yaml，可据此生成 SBOM（软件物料清单），核到每个包的版本与哈希。',
  ],
  licenseTitle: '依赖许可',
  licenseItems: [
    '本项目自身以 AGPL-3.0-only 授权，另有商业许可可选（见定价页）。',
    '核心依赖均为宽松或弱 copyleft 许可：PDF 引擎 pdfjs-dist 与表格引擎 Univer 为 Apache-2.0，音视频封装 mediabunny 为 MPL-2.0，其余（docx、pptxgenjs、exceljs、ag-psd、mermaid、konva 等）为 MIT。',
    '不含 GPL / LGPL 传染性依赖，因此可以合法地双许可，也可以在内网闭源环境中使用。',
  ],
  deployTitle: '在内网里的形态',
  deployItems: [
    '离线部署包不依赖任何外部服务：没有字体 CDN、没有版本检查、没有遥测上报，DNS 出站为零。',
    '授权走本地离线验签：不联网激活、不生成机器指纹、不上报使用量 —— 企业最反感的三件事一个都不做。具体授权方式随企业服务器版方案确定。',
    '更新以季度包的形态交付，由客户自行决定何时上线，不存在「强制自动更新」。',
  ],
  disclosureTitle: '完整披露：仅有的联网行为',
  disclosureLead: '安全说明的可信度取决于它是否愿意写例外。以下是站上全部可能产生的对外行为：',
  disclosureItems: [
    '桌面版：默认检查更新（向 GitHub Releases 查询最新版本），可在设置中关闭；关闭后没有任何出站请求。',
    '网页版埋点：由部署方决定是否启用，默认关闭。启用时只上报事件名（打开工具 / 处理完成 / 处理失败）、工具 id、耗时与界面语言，不含任何输入内容、文件名或结果；不使用 Cookie，不做跨站标识，浏览器 DNT 或 GPC 生效时直接停采。',
    '除此之外没有其它出站请求：无广告、无社交按钮、无错误上报服务、无崩溃收集。',
  ],
  faqTitle: '采购常见问题',
  faq: [
    {
      q: '能过等保吗？',
      a: '企业服务器版形态下数据不出网、无外部依赖、无远程管理通道，可以按等保 2.0 的「数据完整性 / 数据保密性 / 入侵防范」条款逐项应答。我们能提供部署拓扑、组件清单、依赖许可清单与安全说明；具体定级与测评由测评机构完成，我们不代替其结论。',
    },
    {
      q: '是否涉及数据出境？',
      a: '不涉及。服务器版（社区版与企业版）部署在贵方自己的机器上，不存在出站连接；网页版不收集文件内容，也不把任何输入传给服务器。',
    },
    {
      q: '能否做源码审计或代码托管在内部 Git？',
      a: '公开版可直接审计。若需要指定版本的源码快照与 SBOM，可在商业许可中约定，并支持一次性只读镜像到贵方内部代码库。',
    },
    {
      q: '能关闭所有联网功能吗？',
      a: '可以。服务器版部署包默认不带更新检查与埋点，交付即可断网运行；桌面社区版没有自动更新，桌面专业版在设置里关闭「检查更新」后同样无出站请求。',
    },
    {
      q: 'AGPL-3.0 会不会要求我们开源自己的系统？',
      a: 'AGPL 的义务针对「本软件及其衍生作品的源码提供」，不会传染你自有系统。但若你修改了本软件并对外提供服务，则需公开修改部分。购买商业许可可完全免除该义务，这也是不少单位选择商业许可的原因。',
    },
  ],
  ctaTitle: '需要放进标书的材料？',
  ctaBody:
    '可以按贵方评审模板提供：安全说明白皮书、部署拓扑图、组件与依赖清单、等保应答建议、采购应答模板。',
  ctaLabel: '索取安全说明与采购材料',
  ctaSecondary: '查看定价与授权方式',
};

const en: SecurityCopy = {
  title: 'Security & compliance',
  lead: '"Your data never leaves the browser" is not a slogan here — it is a technical fact you can verify line by line. ',
  dataTitle: 'Where data is processed',
  dataItems: [
    'The web app has no upload endpoint. Files enter page memory through the native file picker or drag-and-drop, and are parsed, transformed and exported locally via Canvas, WebAssembly and JavaScript.',
    'The only network request the site requires is loading its own static assets (HTML / JS / CSS / WASM). Processing a file produces no outbound traffic.',
    'How to verify: open the Network panel, enable "Preserve log", process any PDF or image, and watch XHR / Fetch / WebSocket stay at zero.',
  ],
  cspTitle: 'Content-Security-Policy',
  cspLead:
    'The CSP is delivered as a response header and enforced by the browser. These are not declarations — each line actually blocks something:',
  cspItems: [
    {
      term: "default-src 'self'",
      desc: 'Only same-origin assets by default; anything from an external domain is refused.',
    },
    {
      term: "connect-src 'self' data: blob:",
      desc: 'Network requests may only go back to this origin. Third-party analytics, behavioural tracking and A/B scripts physically cannot run — which is precisely why none are used.',
    },
    {
      term: "script-src 'self' 'wasm-unsafe-eval'",
      desc: 'Inline and CDN scripts are forbidden; wasm-unsafe-eval exists only to compile the WebAssembly used for media processing (ffmpeg.wasm).',
    },
    {
      term: "img-src 'self' data: blob:",
      desc: 'Images limited to this origin, inline data URLs and local blobs used for previews.',
    },
    {
      term: "worker-src 'self' blob:",
      desc: 'Local scripts may be wrapped as Workers; Workers cannot be loaded remotely.',
    },
    {
      term: 'frame-ancestors none',
      desc: 'No page here can be framed by any other site, which removes clickjacking wrappers.',
    },
    {
      term: 'object-src none',
      desc: 'Browser plugins disabled — the classic attack surface simply does not exist.',
    },
    {
      term: "form-action 'self'",
      desc: 'Forms can only post back to this origin and cannot be hijacked elsewhere.',
    },
  ],
  cspLinkLabel: 'Read the full policy in the repository (public/_headers and vercel.json)',
  cspCaveat:
    'One relaxation, disclosed: style-src allows unsafe-inline. Editor theme colours, panel sizes and canvas transforms need dynamic inline styles — a presentational capability that cannot execute script.',
  thirdTitle: 'No third-party runtime dependencies',
  thirdItems: [
    'No CDN scripts, styles, fonts or icon packs are loaded: typography uses the system font stack, icons are inline SVG, and every editor and codec ships with the build from this origin.',
    'No tracking cookies and no tracking pixels or beacons, so third-party cross-site profiling is impossible by construction.',
  ],
  auditTitle: 'Audit it yourself instead of trusting us',
  auditItems: [
    'The source is public on GitHub under AGPL-3.0 — clone, read and build it yourself.',
    'Builds run offline: after pnpm install && pnpm build, serve dist/ from any static server and every tool works with networking switched off.',
    'Dependencies are pinned in pnpm-lock.yaml, so an SBOM can be generated down to each package version and hash.',
  ],
  licenseTitle: 'Dependency licensing',
  licenseItems: [
    'The project itself is AGPL-3.0-only, with a commercial licence available (see pricing).',
    'Core dependencies use permissive or weak copyleft terms: pdfjs-dist (PDF engine) and Univer (spreadsheet engine) are Apache-2.0, mediabunny (media muxing) is MPL-2.0, and the rest — docx, pptxgenjs, exceljs, ag-psd, mermaid, konva and friends — are MIT.',
    'No GPL / LGPL viral dependencies, which is what makes dual licensing lawful and closed intranet use possible.',
  ],
  deployTitle: 'What it looks like on an intranet',
  deployItems: [
    'The offline bundle depends on no external service: no font CDN, no version check, no telemetry. Outbound DNS is zero.',
    'Licensing is verified offline on the local machine: no activation call, no machine fingerprint, no usage reporting — the three things enterprises dislike most. The exact model will be settled with the Enterprise Server plan.',
    'Updates ship as quarterly bundles and the customer decides when to roll them out. There is no forced auto-update.',
  ],
  disclosureTitle: 'Full disclosure: the only network activity',
  disclosureLead:
    'A security statement is only as credible as its willingness to list exceptions. Here is every outbound behaviour the product can produce:',
  disclosureItems: [
    'Desktop: an update check against GitHub Releases, on by default, switchable off in settings; with it off there are no outbound requests at all.',
    'Web analytics: the operator decides whether to enable it; it is off by default. When enabled it reports only the event name (tool opened / export finished / tool error), tool id, duration and UI language — never input content, file names or results. No cookies, no cross-site identifier, and collection stops entirely when DNT or GPC is signalled.',
    'Nothing else: no ads, no social widgets, no third-party error reporting, no crash collection.',
  ],
  faqTitle: 'Procurement questions',
  faq: [
    {
      q: 'Will this pass a security review?',
      a: 'In an Enterprise Server deployment there is no egress, no external dependency and no remote management channel, so the data-confidentiality, data-integrity and intrusion-prevention control families can be answered item by item. We provide the topology, component inventory, dependency licence list and security notes; grading and formal assessment remain with your accredited assessor.',
    },
    {
      q: 'Does any data cross a border?',
      a: 'No. The server editions run on your own hardware with no outbound connection, and the web app never sends file contents or inputs to a server.',
    },
    {
      q: 'Can we audit the source, or mirror it into our own Git?',
      a: 'The public build can be audited directly. If you need a pinned source snapshot plus SBOM, that can be written into the commercial licence, including a one-off read-only mirror into your internal Git.',
    },
    {
      q: 'Can every network feature be turned off?',
      a: 'Yes. The server bundle ships without update checks or analytics and runs air-gapped out of the box. Desktop Community has no auto-update; on Desktop Pro, disabling "check for updates" leaves zero outbound requests.',
    },
    {
      q: 'Does AGPL-3.0 force us to open-source our own systems?',
      a: 'AGPL obligations attach to this software and its derivatives, not to your own systems. If you modify this software and offer it as a network service, the modifications must be published. A commercial licence removes that obligation entirely, which is why many organisations choose it.',
    },
  ],
  ctaTitle: 'Need material for a tender document?',
  ctaBody:
    'We can supply, in your review template: the security whitepaper, deployment topology, component and dependency inventory, compliance response guidance and a procurement response template.',
  ctaLabel: 'Request security & procurement pack',
  ctaSecondary: 'See pricing and licensing',
};

const ja: SecurityCopy = {
  title: 'セキュリティとコンプライアンス',
  lead: '「データはブラウザの外に出ません」は標語ではなく、一つずつ検証できる技術的事実です。',
  dataTitle: 'データの処理場所',
  dataItems: [
    'Web 版にアップロード用のエンドポイントはありません。ファイルはブラウザ標準のファイル選択またはドラッグ＆ドロップでページのメモリに入り、Canvas・WebAssembly・JavaScript によって端末内で解析・変換・出力されます。',
    'サイトに必要な通信は、ページ自身の静的ファイル（HTML / JS / CSS / WASM）の読み込みだけです。ファイル処理中に外部への通信は発生しません。',
    '検証方法：開発者ツールの Network パネルで「ログを保持」を有効にし、任意の PDF や画像を処理して、XHR / Fetch / WebSocket がゼロのままであることを確認してください。',
  ],
  cspTitle: 'Content-Security-Policy（CSP）',
  cspLead:
    'CSP はレスポンスヘッダーとして配信され、ブラウザが強制します。単なる宣言ではなく、各行が実際に何かを遮断します：',
  cspItems: [
    {
      term: "default-src 'self'",
      desc: '既定では同一オリジンのリソースのみ。外部ドメインの読み込みは拒否されます。',
    },
    {
      term: "connect-src 'self' data: blob:",
      desc: '通信は同一オリジンへのみ。第三者の解析・行動追跡・A/B テスト用スクリプトは物理的に動作できません。当サイトがそれらを使わない理由でもあります。',
    },
    {
      term: "script-src 'self' 'wasm-unsafe-eval'",
      desc: 'インラインスクリプトと CDN スクリプトを禁止。wasm-unsafe-eval はメディア処理用 WebAssembly（ffmpeg.wasm）のコンパイルにのみ使用します。',
    },
    {
      term: "img-src 'self' data: blob:",
      desc: '画像は同一オリジン、インライン data URL、プレビュー用のローカル blob に限定。',
    },
    {
      term: "worker-src 'self' blob:",
      desc: 'ローカルスクリプトを Worker として使うことは許可、外部からの Worker 読み込みは禁止。',
    },
    {
      term: 'frame-ancestors none',
      desc: '他サイトによる iframe 埋め込みを全面禁止し、クリックジャッキングの入れ子を排除。',
    },
    {
      term: 'object-src none',
      desc: 'ブラウザプラグインを無効化。古典的な攻撃面そのものが存在しません。',
    },
    {
      term: "form-action 'self'",
      desc: 'フォームの送信先は同一オリジンのみ。第三者への転送はできません。',
    },
  ],
  cspLinkLabel: 'リポジトリで完全なポリシーを確認（public/_headers と vercel.json）',
  cspCaveat:
    '緩和している点を明記します：style-src に unsafe-inline を含みます。エディタのテーマ色・パネル寸法・キャンバス変換に動的なインラインスタイルが必要なためで、スクリプト実行は許可されません。',
  thirdTitle: '実行時の第三者依存はありません',
  thirdItems: [
    'CDN 上のスクリプト・スタイル・フォント・アイコンライブラリは一切読み込みません。フォントはシステムフォント、アイコンはインライン SVG、エディタとコーデックはビルド成果物として同一オリジンから配信します。',
    '追跡 Cookie もトラッキングピクセルもビーコンも使用しないため、第三者によるクロスサイト profiling は構造上成立しません。',
  ],
  auditTitle: '信じるのではなく、自分で監査できます',
  auditItems: [
    'ソースは AGPL-3.0 で GitHub に公開されています。clone して読み、ビルドできます。',
    'ビルド成果物はオフラインで動作します。pnpm install && pnpm build の後、dist/ を任意の静的サーバーに置けば、ネットワークを切ったまま全ツールが使えます。',
    '依存は pnpm-lock.yaml で固定されており、パッケージのバージョンとハッシュまで SBOM を生成できます。',
  ],
  licenseTitle: '依存ライセンス',
  licenseItems: [
    '本プロジェクト自体は AGPL-3.0-only、別途商用ライセンスを用意しています（料金ページ参照）。',
    '主要な依存は寛容または弱いコピーレフトです。PDF エンジンの pdfjs-dist と表計算エンジンの Univer は Apache-2.0、メディア処理の mediabunny は MPL-2.0、その他（docx、pptxgenjs、exceljs、ag-psd、mermaid、konva など）は MIT です。',
    'GPL / LGPL の伝播性依存を含まないため、デュアルライセンスが合法に成立し、クローズドな社内環境でも利用できます。',
  ],
  deployTitle: '社内ネットワークでの形態',
  deployItems: [
    'オフライン配布物は外部サービスに依存しません。フォント CDN なし、バージョンチェックなし、テレメトリなし。外向き DNS はゼロです。',
    'ライセンスはローカルでのオフライン検証とします。アクティベーション通信なし、端末指紋なし、利用量の送信なし —— 企業が最も嫌う三点をいずれも行いません。具体的な方式はエンタープライズ サーバー版の計画と併せて確定します。',
    '更新は四半期ごとのパッケージで提供し、適用時期はお客様が決めます。強制自動更新はありません。',
  ],
  disclosureTitle: '完全開示：唯一の通信',
  disclosureLead:
    'セキュリティ説明の信頼性は、例外を書く姿勢で決まります。本製品が発生しうる外向き通信は次のとおりです：',
  disclosureItems: [
    'デスクトップ版：GitHub Releases へのアップデート確認（既定で有効、設定で無効化可能）。無効化すると外向き通信は一切ありません。',
    'Web 版の計測：導入者が有効化を判断し、既定では無効です。有効時も送信するのはイベント名（ツール起動／出力完了／エラー）、ツール id、所要時間、表示言語のみで、入力内容・ファイル名・結果は含みません。Cookie 不使用、クロスサイト識別子なし、DNT または GPC が有効なら収集を停止します。',
    'その他はありません。広告なし、ソーシャルボタンなし、外部エラー収集なし、クラッシュ収集なし。',
  ],
  faqTitle: '調達に関するご質問',
  faq: [
    {
      q: 'セキュリティ審査は通りますか？',
      a: 'エンタープライズ サーバー版では外部送信がなく、外部依存も遠隔管理経路もありません。データの完全性・機密性・侵入防止の各統制について項目ごとに回答できます。構成図、コンポーネント一覧、依存ライセンス一覧、セキュリティ説明を提出します。格付けと正式評価は認定評価機関が行うものであり、当社が代行するものではありません。',
    },
    {
      q: 'データの国外移転はありますか？',
      a: 'ありません。サーバー版はお客様の管理するマシン上で動作し、外向き通信はありません。Web 版もファイル内容や入力内容をサーバーへ送信しません。',
    },
    {
      q: 'ソース監査や社内 Git へのミラーは可能ですか？',
      a: '公開版はそのまま監査できます。特定バージョンのソーススナップショットと SBOM が必要な場合は商用ライセンスに明記でき、社内 Git への読み取り専用ミラーも対応します。',
    },
    {
      q: '通信機能をすべて止められますか？',
      a: '可能です。サーバー版のパッケージはアップデート確認も計測も含まず、納品時点で遮断環境で動作します。デスクトップ コミュニティ版は自動アップデートがないため通信なし、プロ版も「アップデートを確認」をオフにすれば外向き通信はありません。',
    },
    {
      q: 'AGPL-3.0 は自社システムの公開を要求しますか？',
      a: 'AGPL の義務は本ソフトウェアおよびその派生作品のソース提供に関するもので、自社システムには伝播しません。ただし本ソフトウェアを改変しネットワーク経由で提供する場合は改変部分の公開が必要です。商用ライセンスはこの義務を完全に免除します。',
    },
  ],
  ctaTitle: '入札資料が必要ですか？',
  ctaBody:
    '貴社の審査様式に合わせて、セキュリティ白書、構成図、コンポーネントと依存の一覧、コンプライアンス回答の指針、調達回答テンプレートを提供できます。',
  ctaLabel: 'セキュリティ資料を請求する',
  ctaSecondary: '料金とライセンスを見る',
};

const copyDict: Partial<Record<PageLang, SecurityCopy>> & { en: SecurityCopy } = { zh, en, ja };

export function SecurityPage() {
  const lang = usePageLang();
  const c = useMemo(() => pickCopy(copyDict, lang), [lang]);

  useEffect(() => {
    document.title = `${c.title} · SynTools`;
    track('page_view', { page: 'security' });
  }, [c.title]);

  return (
    <PageShell title={c.title} lead={c.lead}>
      <Section title={c.dataTitle}>
        <Paragraphs items={c.dataItems} />
      </Section>

      <Section title={c.cspTitle}>
        <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{c.cspLead}</p>
        <DefinitionList items={c.cspItems} />
        <p className="mt-2 text-xs">
          <a
            href={`${GITHUB_REPO_URL}/blob/main/public/_headers`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {c.cspLinkLabel}
          </a>
        </p>
        <NoteBar icon="info">{c.cspCaveat}</NoteBar>
      </Section>

      <Section title={c.thirdTitle}>
        <CheckList items={c.thirdItems} />
      </Section>

      <Section title={c.auditTitle}>
        <CheckList items={c.auditItems} />
      </Section>

      <Section title={c.licenseTitle}>
        <CheckList items={c.licenseItems} />
      </Section>

      <Section title={c.deployTitle}>
        <CheckList items={c.deployItems} />
      </Section>

      <Section title={c.disclosureTitle}>
        <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {c.disclosureLead}
        </p>
        <CheckList items={c.disclosureItems} />
      </Section>

      <Section title={c.faqTitle}>
        <FaqList items={c.faq} />
      </Section>

      <Section title={c.ctaTitle}>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{c.ctaBody}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a
            href={inquiryHref('security-review')}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('inquiry_click', { from: 'security' })}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {c.ctaLabel}
          </a>
          <Link
            to="/pricing"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {c.ctaSecondary}
          </Link>
        </div>
      </Section>
    </PageShell>
  );
}
