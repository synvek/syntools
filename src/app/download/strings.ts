import type { Lang } from '@/core/i18n';

/**
 * Copy for the /download page.
 *
 * Note: these strings stay out of `core/i18n/locales/*` for now. The shell packs use zh's keys as
 * the type source for `ShellResources` (see `core/i18n/types.ts`), so a new section forces
 * all 9 locale files to be filled in at once or typecheck fails. To avoid another batch of machine translation,
 * only hand-written zh / en / ja are provided here, with other languages falling back to English.
 *
 * To fold this page into the official packs later: first add `download.*` to all 9 locale files,
 * then swap the calls here for `t('download.xxx')`.
 */
export interface DownloadStrings {
  title: string;
  lead: string;
  versionLabel: string;
  recommended: string;
  macos: string;
  windows: string;
  linux: string;
  appleSilicon: string;
  intel: string;
  x64: string;
  arm64: string;
  openReleases: string;
  allReleases: string;
  installTitle: string;
  installMac: string;
  installWin: string;
  installLinux: string;
  whyTitle: string;
  why1: string;
  why2: string;
  why3: string;
  privacy: string;
  webVersion: string;
  fileNameHint: string;
}

const zh: DownloadStrings = {
  title: '下载桌面社区版',
  lead: '装上就能离线用：153 个工具、全部在本机计算，文件不出你的电脑。无需联网、无需注册账号。这里提供的是社区版，按 AGPL-3.0 免费授权。',
  versionLabel: '当前版本',
  recommended: '为你的系统推荐',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  appleSilicon: 'Apple Silicon（M 系列）',
  intel: 'Intel 芯片',
  x64: 'x64 / AMD64',
  arm64: 'ARM64',
  openReleases: '前往下载',
  allReleases: '查看全部版本与更新说明',
  installTitle: '安装说明',
  installMac: 'macOS：打开 .dmg 后把 SynTools 拖入「应用程序」，再从「应用程序」中打开。',
  installWin: 'Windows：运行 .exe 安装包，或安装 .msi。',
  installLinux: 'Linux：.deb / .rpm 用包管理器安装；AppImage 下载后先 chmod +x 再直接运行。',
  whyTitle: '装桌面版能得到什么',
  why1: '不撞浏览器内存墙。网页版处理几百 MB 的 PDF、长视频时会受标签页内存限制，桌面版没有这个天花板。',
  why2: '真正的离线可用。断网、内网、出差路上都能跑，全程没有任何外部请求。',
  why3: '直接读写本地目录，不再受浏览器沙箱约束，批量处理更顺手。',
  privacy:
    '隐私边界与网页版一致：所有处理都在你的机器上完成，不收集内容、不上传文件。社区版不含自动更新，因此没有任何外部请求。',
  webVersion: '不想安装？直接用网页版',
  fileNameHint:
    '安装包按「版本-构建号」命名，例如 SynTools-0.8.0-29-x64.dmg；在 Releases 页按系统与架构选择即可。',
};

const en: DownloadStrings = {
  title: 'Download Desktop Community',
  lead: 'Install once, then work offline: 153 tools that run entirely on your machine. No account, no uploads. This is the community edition, free under AGPL-3.0.',
  versionLabel: 'Version',
  recommended: 'Recommended for your system',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  appleSilicon: 'Apple Silicon (M series)',
  intel: 'Intel',
  x64: 'x64 / AMD64',
  arm64: 'ARM64',
  openReleases: 'Get the installer',
  allReleases: 'All releases and changelogs',
  installTitle: 'Install notes',
  installMac: 'macOS: open the .dmg, drag SynTools into Applications, then launch it from there.',
  installWin: 'Windows: run the .exe installer, or install the .msi.',
  installLinux:
    'Linux: install the .deb / .rpm with your package manager, or chmod +x the AppImage and run it directly.',
  whyTitle: 'What the desktop app adds',
  why1: 'No browser memory ceiling. Large PDFs and long videos that strain a browser tab run comfortably on the desktop build.',
  why2: 'Genuinely offline. Works on a plane, on an intranet, or with networking off — zero external requests.',
  why3: 'Direct local file access without the browser sandbox, so batch jobs are far less awkward.',
  privacy:
    'Same privacy boundary as the web version: everything is processed on your machine, no content is collected, nothing is uploaded. The community build has no auto-update, so it makes no outbound requests at all.',
  webVersion: 'Prefer not to install? Use the web version',
  fileNameHint:
    'Installers are named "version-build", e.g. SynTools-0.8.0-29-x64.dmg — pick the one matching your OS and architecture on the Releases page.',
};

const ja: DownloadStrings = {
  title: 'デスクトップ コミュニティ版をダウンロード',
  lead: 'インストールすればオフラインで使えます。153 のツールがすべて端末内で動作し、ファイルは外部に送信されません。アカウント登録も不要です。ここで配布しているのは AGPL-3.0 の無料コミュニティ版です。',
  versionLabel: '現在のバージョン',
  recommended: 'お使いの環境におすすめ',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  appleSilicon: 'Apple Silicon（M シリーズ）',
  intel: 'Intel',
  x64: 'x64 / AMD64',
  arm64: 'ARM64',
  openReleases: 'ダウンロードへ',
  allReleases: 'すべてのリリースと変更履歴',
  installTitle: 'インストール手順',
  installMac:
    'macOS：.dmg を開いて SynTools を「アプリケーション」へドラッグし、そこから起動します。',
  installWin: 'Windows：.exe インストーラーを実行、または .msi をインストールします。',
  installLinux:
    'Linux：.deb / .rpm はパッケージマネージャーで導入し、AppImage は chmod +x してから直接実行します。',
  whyTitle: 'デスクトップ版の利点',
  why1: 'ブラウザのメモリ上限がありません。数百 MB の PDF や長い動画も、タブの制約を受けずに処理できます。',
  why2: '完全なオフライン動作。機内でも社内ネットワークでも、外部通信ゼロで動きます。',
  why3: 'ブラウザのサンドボックスを介さずローカルフォルダーを直接読み書きできるため、一括処理が快適です。',
  privacy:
    'プライバシーの境界は Web 版と同じです。処理はすべて端末内で完結し、内容の収集もファイルの送信も行いません。コミュニティ版は自動アップデートを含まないため、外部通信は一切ありません。',
  webVersion: 'インストールせずに使う場合は Web 版へ',
  fileNameHint:
    'インストーラーは「バージョン-ビルド番号」の形式（例：SynTools-0.8.0-29-x64.dmg）。Releases ページで OS とアーキテクチャに合うものを選んでください。',
};

export const downloadStrings: Partial<Record<Lang, DownloadStrings>> = { zh, en, ja };

/** Pick copy: uncovered languages fall back to English */
export function getDownloadStrings(lang: Lang): DownloadStrings {
  return downloadStrings[lang] ?? en;
}
