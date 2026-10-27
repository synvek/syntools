import { useEffect, useMemo, type ReactNode } from 'react';
import { Link } from '@/core/components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { normalizeLang } from '@/core/i18n';
import { track, trackDownloadClick } from '@/core/analytics';
import { getDownloadStrings, type DownloadStrings } from '@/app/download/strings';

const RELEASES_URL = 'https://github.com/synvek/syntools/releases/latest';
const REPO_URL = 'https://github.com/synvek/syntools';

type Platform = 'mac' | 'win' | 'linux' | 'unknown';

/**
 * Coarse platform detection: only drives the "recommended" highlight, never the download URL.
 *
 * Installer filenames carry a build number (e.g. SynTools-0.8.0-29-x64.dmg) that package.json cannot supply,
 * so every button points at the latest Releases page and users pick their architecture there.
 */
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const raw =
    `${uaData?.platform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`.toLowerCase();
  // Do not recommend the desktop build on mobile; Android/iOS must not read as Linux/macOS
  if (/android|iphone|ipad|ipod/.test(raw)) return 'unknown';
  if (raw.includes('mac')) return 'mac';
  if (raw.includes('win')) return 'win';
  if (raw.includes('linux') || raw.includes('x11')) return 'linux';
  return 'unknown';
}

interface ArchOption {
  /** Stable id for analytics (never changes with the UI language) */
  key: string;
  label: string;
  hint: string;
}

function PlatformCard({
  title,
  arches,
  recommended,
  recommendedLabel,
  cta,
}: {
  title: string;
  arches: ArchOption[];
  recommended: boolean;
  recommendedLabel: string;
  cta: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-white p-4 dark:bg-gray-900 ${
        recommended
          ? 'border-blue-300 ring-1 ring-blue-200 dark:border-blue-700 dark:ring-blue-900'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          name="download"
          className={`h-4 w-4 ${recommended ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
        />
        <h3 className="font-semibold">{title}</h3>
        {recommended && (
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {recommendedLabel}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {arches.map((arch) => (
          <li key={arch.key}>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackDownloadClick(arch.key)}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
            >
              <span>{arch.label}</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                {arch.hint}
                <Icon name="chevronRight" className="h-3.5 w-3.5" />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-auto pt-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {cta}
      </a>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</h2>
      {children}
    </section>
  );
}

export function DownloadPage() {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';
  const s: DownloadStrings = useMemo(() => getDownloadStrings(lang), [lang]);
  const platform = useMemo<Platform>(() => detectPlatform(), []);

  // Page views are the denominator for "visitor → installer click" (clicks are already tracked per arch)
  useEffect(() => {
    track('page_view', { page: 'download', os: platform });
  }, [platform]);

  const archOptions: Record<'mac' | 'win' | 'linux', ArchOption[]> = {
    mac: [
      { key: 'mac-arm64', label: s.appleSilicon, hint: '.dmg' },
      { key: 'mac-x64', label: s.intel, hint: '.dmg' },
    ],
    win: [
      { key: 'win-x64-exe', label: `${s.x64} · .exe`, hint: '.exe' },
      { key: 'win-x64-msi', label: `${s.x64} · .msi`, hint: '.msi' },
      { key: 'win-arm64-exe', label: `${s.arm64} · .exe`, hint: '.exe' },
    ],
    linux: [
      { key: 'linux-x64-appimage', label: `${s.x64} · AppImage`, hint: '.AppImage' },
      { key: 'linux-x64-deb', label: `${s.x64} · .deb`, hint: '.deb' },
      { key: 'linux-x64-rpm', label: `${s.x64} · .rpm`, hint: '.rpm' },
      { key: 'linux-arm64-appimage', label: `${s.arm64} · AppImage`, hint: '.AppImage' },
    ],
  };

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-bold">{s.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">{s.lead}</p>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {s.versionLabel} v{__APP_VERSION__}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <PlatformCard
          title={s.macos}
          arches={archOptions.mac}
          recommended={platform === 'mac'}
          recommendedLabel={s.recommended}
          cta={s.openReleases}
        />
        <PlatformCard
          title={s.windows}
          arches={archOptions.win}
          recommended={platform === 'win'}
          recommendedLabel={s.recommended}
          cta={s.openReleases}
        />
        <PlatformCard
          title={s.linux}
          arches={archOptions.linux}
          recommended={platform === 'linux'}
          recommendedLabel={s.recommended}
          cta={s.openReleases}
        />
      </div>

      <Section title={s.installTitle}>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          {[s.installMac, s.installWin, s.installLinux].map((text) => (
            <li key={text} className="rounded-md bg-gray-50 p-3 dark:bg-gray-900">
              {text}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={s.whyTitle}>
        <ul className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-3 dark:text-gray-300">
          {[s.why1, s.why2, s.why3].map((text) => (
            <li
              key={text}
              className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              {text}
            </li>
          ))}
        </ul>
      </Section>

      <p className="mt-6 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{s.privacy}</span>
      </p>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{s.fileNameHint}</p>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <Link to="/" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          {s.webVersion}
        </Link>
        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          {s.allReleases}
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-gray-500 hover:underline dark:text-gray-400"
        >
          <Icon name="github" className="h-4 w-4" />
          GitHub
        </a>
      </div>
    </div>
  );
}
