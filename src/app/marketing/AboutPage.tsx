import { useEffect, useMemo } from 'react';
import { Link } from '@/core/components/LocaleLink';
import { track } from '@/core/analytics';
import { tools } from '@/core/registry';
import {
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  fill,
  pickCopy,
  usePageLang,
  type PageLang,
} from '@/app/marketing/copy';
import { CheckList, NoteBar, PageShell, Paragraphs, Section } from '@/app/marketing/ui';

/**
 * /about — about the project.
 *
 * Before pricing, enterprise reviewers and technical users usually confirm three things: who built this,
 * whether it will vanish tomorrow, and whether the license lets them use it. This page answers those three, no vision talk.
 */

interface AboutCopy {
  title: string;
  lead: string;
  whatTitle: string;
  whatItems: string[];
  whyTitle: string;
  whyItems: string[];
  whoTitle: string;
  whoItems: string[];
  licenseTitle: string;
  licenseItems: string[];
  techTitle: string;
  techItems: string[];
  note: string;
  links: { pricing: string; security: string; download: string; issues: string; source: string };
}

const zh: AboutCopy = {
  title: '关于 SynTools',
  lead: '一个纯前端的在线工具集：{n} 个工具，全部在你的浏览器里运行，文件不上传。',
  whatTitle: '这是什么',
  whatItems: [
    '把日常零碎的工具收拢到一个入口：编解码、格式化、哈希、时间戳、正则、JSON，图片与照片编辑，PDF 全家桶，以及 Word / Excel / PowerPoint 的浏览器内编辑器。',
    '没有广告，没有「下载前等待 30 秒」，没有需要注册才能用的功能。搜索用 ⌘K，收藏与最近使用记在本机。',
    '网页版是主体，桌面社区版与专业版是同一套界面的离线形态，供需要处理大文件或在没有外网的环境里使用的场景；服务器版则把同一份构建产物部署到自己的机器或内网。',
  ],
  whyTitle: '为什么做它',
  whyItems: [
    '日常要转个 PDF、压张图、格式化一段 JSON，搜索结果里排在前面的往往是三件事的组合：满屏广告、上传到不明服务器、以及「免费」但限次。',
    '对个人来说这是体验问题；对处理合同、报表、病历、图纸的人来说，这是合规问题 —— 「为了转一个 PDF 把文件传到境外网站」在不少单位是明确禁止的。',
    '所以这个项目的两个目标很具体：把工具做全，并且让文件从头到尾不离开你的机器。',
  ],
  whoTitle: '谁在做',
  whoItems: [
    '由独立开发者 synvek 设计与编写，{n} 个工具、9 种界面语言、全平台桌面端均为同一套代码库。',
    '项目在 GitHub 上公开开发，问题与建议走 Issues。没有融资、没有增长团队，也就没有把用户数据变成收入的压力 —— 这是纯本地处理能长期成立的前提。',
  ],
  licenseTitle: '许可',
  licenseItems: [
    '以 AGPL-3.0-only 开源：可以自由使用、修改、自建，修改后对外提供服务时需要公开修改部分。',
    '同时提供商业许可，用于不希望承担 AGPL 义务的闭源或内网场景（详见定价页）。',
    '依赖均为 MIT / Apache-2.0 / MPL-2.0，无 GPL 传染性依赖，因此双许可在法律上成立。',
  ],
  techTitle: '技术形态',
  techItems: [
    'React + TypeScript + Vite，构建为纯静态站点，可托管在任何静态服务器；桌面端用 Tauri 打包，体积小、内存占用低。',
    '文档与图像处理在本机完成：PDF 解析用 pdfjs-dist，表格用 Univer，编解码与压缩用 Canvas / WebAssembly，音视频用浏览器原生的 WebCodecs。',
    '全部资源同源分发，不依赖任何 CDN，因此可以完全离线运行 —— 这也是服务器版（社区版与企业版）能成立的技术基础。',
  ],
  note: '想直接看它能不能用？随便打开一个工具试一下，不需要注册。',
  links: {
    pricing: '定价与授权',
    security: '安全与合规',
    download: '下载桌面版',
    issues: '反馈问题',
    source: '查看源码',
  },
};

const en: AboutCopy = {
  title: 'About SynTools',
  lead: 'A purely front-end toolkit: {n} tools that run in your browser, with no file uploads.',
  whatTitle: 'What it is',
  whatItems: [
    'Everyday utilities in one place: encoding, formatting, hashing, timestamps, regex, JSON, image and photo editing, a full PDF suite, and in-browser Word / Excel / PowerPoint editors.',
    'No ads, no "wait 30 seconds before downloading", no features locked behind a signup. Search with ⌘K; favourites and recents stay on your machine.',
    'The web app is the main product. Desktop Community and Pro are the same interface offline, for large files and air-gapped machines; the server editions put that same build on your own hardware.',
  ],
  whyTitle: 'Why it exists',
  whyItems: [
    'Converting a PDF, compressing an image or formatting JSON usually means a page of ads, an upload to an unknown server, and a "free" tier that runs out.',
    'For individuals that is an annoyance. For people handling contracts, financial reports, medical records or drawings, it is a compliance problem — "upload that PDF to an overseas site just to convert it" is explicitly forbidden in many organisations.',
    'So the two goals are narrow and concrete: cover the tools, and keep files on your machine from start to finish.',
  ],
  whoTitle: 'Who builds it',
  whoItems: [
    'Designed and written by an independent developer, synvek: {n} tools, nine interface languages and desktop builds for every major platform, all from one codebase.',
    'Development happens in the open on GitHub; issues and suggestions go through Issues. No funding and no growth team means no pressure to monetise user data — the precondition for local-only processing to stay true.',
  ],
  licenseTitle: 'Licensing',
  licenseItems: [
    'Open source under AGPL-3.0-only: use, modify and self-host freely; if you modify it and offer it as a network service, publish the modifications.',
    'A commercial licence is available for closed-source and intranet deployments that cannot carry AGPL obligations (see pricing).',
    'Dependencies are MIT / Apache-2.0 / MPL-2.0 with no viral GPL components, which is what makes dual licensing lawful.',
  ],
  techTitle: 'Under the hood',
  techItems: [
    'React + TypeScript + Vite, built as a static site that any static server can host; the desktop build uses Tauri for a small footprint.',
    'Document and image work happens locally: pdfjs-dist for PDF parsing, Univer for spreadsheets, Canvas / WebAssembly for codecs and compression, and the browser-native WebCodecs API for audio and video.',
    'All assets are served from this origin with no CDN dependency, which is what allows genuinely offline operation — and, in turn, the server editions.',
  ],
  note: 'Want to see whether it actually works? Open any tool — no signup required.',
  links: {
    pricing: 'Pricing & licensing',
    security: 'Security & compliance',
    download: 'Download desktop',
    issues: 'Report an issue',
    source: 'Read the source',
  },
};

const ja: AboutCopy = {
  title: 'SynTools について',
  lead: '純フロントエンドのツール集。{n} のツールがすべてブラウザ内で動作し、ファイルは送信されません。',
  whatTitle: 'これは何か',
  whatItems: [
    '日々の細かい作業を 1 か所にまとめました。エンコード、整形、ハッシュ、タイムスタンプ、正規表現、JSON、画像・写真編集、PDF 一式、そして Word / Excel / PowerPoint のブラウザ内エディタ。',
    '広告なし、「ダウンロードまで 30 秒お待ちください」もなし、登録しないと使えない機能もありません。検索は ⌘K、お気に入りと履歴は端末内に保存されます。',
    '本体は Web 版です。デスクトップ コミュニティ版とプロ版は同じ画面のオフライン形態で、大容量ファイルや外部ネットワークのない環境向け。サーバー版は同じビルドを自社のマシンや社内ネットワークに置く形態です。',
  ],
  whyTitle: 'なぜ作ったか',
  whyItems: [
    'PDF を変換する、画像を圧縮する、JSON を整形する —— 検索の上位はたいてい「広告まみれ」「不明なサーバーへのアップロード」「無料だが回数制限」の組み合わせです。',
    '個人には不便ですが、契約書・決算資料・カルテ・図面を扱う人にとってはコンプライアンス問題です。「PDF を変換するためだけに海外のサイトへ送る」ことは多くの組織で明確に禁止されています。',
    'だから目標は 2 つだけ。ツールを網羅すること、そしてファイルを最初から最後まで端末の外に出さないことです。',
  ],
  whoTitle: '誰が作っているか',
  whoItems: [
    '個人開発者 synvek が設計・実装しています。{n} のツール、9 言語の UI、全プラットフォームのデスクトップ版が同一のコードベースです。',
    '開発は GitHub で公開しています。不具合や要望は Issues へ。資金調達も成長チームもないため、利用者データを収益化する圧力がありません。これがローカル処理のみを長期維持できる前提です。',
  ],
  licenseTitle: 'ライセンス',
  licenseItems: [
    'AGPL-3.0-only で公開しています。利用・改変・自前ホスティングは自由で、改変してネットワーク経由で提供する場合は改変部分の公開が必要です。',
    'AGPL 義務を負えないクローズド／社内環境向けに商用ライセンスも用意しています（料金ページ参照）。',
    '依存は MIT / Apache-2.0 / MPL-2.0 のみで、伝播性のある GPL 依存はありません。デュアルライセンスが法的に成立する理由です。',
  ],
  techTitle: '技術構成',
  techItems: [
    'React + TypeScript + Vite で構築した純静的サイト。任意の静的サーバーに置けます。デスクトップ版は Tauri 製で軽量です。',
    '文書と画像の処理は端末内で完結します。PDF 解析は pdfjs-dist、表計算は Univer、エンコードと圧縮は Canvas / WebAssembly、音声・動画はブラウザ標準の WebCodecs を使用します。',
    'すべての資産を同一オリジンから配信し、CDN に依存しないため完全オフラインで動作します。サーバー版（コミュニティ／エンタープライズ）が成立する技術的な土台です。',
  ],
  note: 'まず試したい場合は、任意のツールを開くだけです。登録は不要です。',
  links: {
    pricing: '料金とライセンス',
    security: 'セキュリティとコンプライアンス',
    download: 'デスクトップ版をダウンロード',
    issues: '問題を報告',
    source: 'ソースを見る',
  },
};

const copyDict: Partial<Record<PageLang, AboutCopy>> & { en: AboutCopy } = { zh, en, ja };

export function AboutPage() {
  const lang = usePageLang();
  const c = useMemo(() => pickCopy(copyDict, lang), [lang]);
  const vars = useMemo(() => ({ n: tools.length }), []);

  useEffect(() => {
    track('page_view', { page: 'about' });
  }, [lang]);

  return (
    <PageShell title={c.title} lead={fill(c.lead, vars)}>
      <Section title={c.whatTitle}>
        <Paragraphs items={c.whatItems.map((item) => fill(item, vars))} />
      </Section>

      <Section title={c.whyTitle}>
        <Paragraphs items={c.whyItems} />
      </Section>

      <Section title={c.whoTitle}>
        <Paragraphs items={c.whoItems.map((item) => fill(item, vars))} />
      </Section>

      <Section title={c.licenseTitle}>
        <CheckList items={c.licenseItems} />
      </Section>

      <Section title={c.techTitle}>
        <CheckList items={c.techItems} />
      </Section>

      <NoteBar icon="info">{c.note}</NoteBar>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link
          to="/pricing"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {c.links.pricing}
        </Link>
        <Link
          to="/security"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {c.links.security}
        </Link>
        <Link
          to="/download"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {c.links.download}
        </Link>
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          {c.links.issues}
        </a>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          {c.links.source}
        </a>
      </div>
      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">AGPL-3.0-only · © SynTools</p>
    </PageShell>
  );
}
