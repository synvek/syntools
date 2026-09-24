import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton } from '@/core/components/ActionButtons';
import { DEFAULT_OPTIONS, renderHeaders, type HeaderOptions, type HeaderTarget } from './core';

const TARGETS: HeaderTarget[] = ['raw', 'nginx', 'apache', 'express', 'vercel'];

export default function HttpHeadersTool() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<HeaderOptions>({ ...DEFAULT_OPTIONS });
  const [target, setTarget] = useState<HeaderTarget>('raw');

  const set = <K extends keyof HeaderOptions>(key: K, value: HeaderOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const output = renderHeaders(options, target);

  const Opt = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="min-w-32">{label}</span>
      {children}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {t('tools.http-headers.options')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Opt label={t('tools.http-headers.opt.hsts')}>
          <input
            type="checkbox"
            checked={options.hsts}
            onChange={(e) => set('hsts', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.hstsMaxAge')}>
          <input
            type="number"
            value={options.hstsMaxAge}
            onChange={(e) => set('hstsMaxAge', Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.includeSubDomains')}>
          <input
            type="checkbox"
            checked={options.includeSubDomains}
            onChange={(e) => set('includeSubDomains', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.preload')}>
          <input
            type="checkbox"
            checked={options.preload}
            onChange={(e) => set('preload', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.csp')}>
          <input
            type="checkbox"
            checked={options.csp}
            onChange={(e) => set('csp', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.frameOptions')}>
          <select
            value={options.frameOptions}
            onChange={(e) => set('frameOptions', e.target.value as HeaderOptions['frameOptions'])}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="none">none</option>
            <option value="deny">DENY</option>
            <option value="sameorigin">SAMEORIGIN</option>
          </select>
        </Opt>
        <Opt label={t('tools.http-headers.opt.contentTypeOptions')}>
          <input
            type="checkbox"
            checked={options.contentTypeOptions}
            onChange={(e) => set('contentTypeOptions', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.permissionsPolicy')}>
          <input
            type="checkbox"
            checked={options.permissionsPolicy}
            onChange={(e) => set('permissionsPolicy', e.target.checked)}
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.referrerPolicy')}>
          <input
            value={options.referrerPolicy}
            onChange={(e) => set('referrerPolicy', e.target.value)}
            className="w-56 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </Opt>
        <Opt label={t('tools.http-headers.opt.coop')}>
          <select
            value={options.coop}
            onChange={(e) => set('coop', e.target.value as HeaderOptions['coop'])}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="none">none</option>
            <option value="same-origin">same-origin</option>
            <option value="same-origin-allow-popups">same-origin-allow-popups</option>
          </select>
        </Opt>
        <Opt label={t('tools.http-headers.opt.coep')}>
          <select
            value={options.coep}
            onChange={(e) => set('coep', e.target.value as HeaderOptions['coep'])}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="none">none</option>
            <option value="require-corp">require-corp</option>
            <option value="credentialless">credentialless</option>
          </select>
        </Opt>
        <Opt label={t('tools.http-headers.opt.corsOrigin')}>
          <input
            value={options.corsOrigin}
            onChange={(e) => set('corsOrigin', e.target.value)}
            placeholder="*"
            className="w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </Opt>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t('tools.http-headers.opt.cspDirectives')}
        </span>
        <textarea
          value={options.cspDirectives}
          onChange={(e) => set('cspDirectives', e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.http-headers.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as HeaderTarget)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {TARGETS.map((tg) => (
              <option key={tg} value={tg}>
                {tg}
              </option>
            ))}
          </select>
        </label>
        <CopyButton text={output} />
        <DownloadButton
          content={output}
          filename={`headers.${target === 'vercel' ? 'json' : 'conf'}`}
        />
      </div>

      <pre className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm dark:border-gray-700 dark:bg-gray-800">
        {output}
      </pre>
    </div>
  );
}
