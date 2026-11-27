import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolResult } from '@/core/types';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { translateToolError } from '@/core/i18n/helpers';
import { normalizeIpInfo, type IpLocation } from './core';

/**
 * 同源接口：带 BASE_URL 前缀，`/zh/tools/ip-location` 这类子路径也能命中。
 * 只在 PLUS_MODE 构建里部署（`functions/api/ip-info.ts`）。
 */
const API = `${import.meta.env.BASE_URL}api/ip-info`;

const FIELDS = [
  'ip',
  'country',
  'province',
  'city',
  'carrier',
  'isp',
  'asn',
  'timezone',
  'postalCode',
  'continent',
  'colo',
] as const;

type Field = (typeof FIELDS)[number];

interface LoadState {
  loading: boolean;
  result: ToolResult<IpLocation> | null;
}

export default function IpLocationTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<LoadState>({ loading: true, result: null });

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ loading: true, result: null });
    try {
      const response = await fetch(API, {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) {
        setState({
          loading: false,
          result:
            response.status === 404
              ? { ok: false, error: 'NOT_FOUND' }
              : { ok: false, error: 'HTTP', params: { status: response.status } },
        });
        return;
      }
      const body: unknown = await response.json();
      setState({ loading: false, result: normalizeIpInfo(body, lang) });
    } catch {
      // 主动取消（切语言 / 卸载）不算失败
      if (controller.signal.aborted) return;
      setState({ loading: false, result: { ok: false, error: 'NETWORK' } });
    }
  }, [lang]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const result = state.result;
  const data = result?.ok ? result.value : null;

  const valueOf = (field: Field): string => {
    if (!data) return '';
    switch (field) {
      case 'ip':
        return data.ip;
      case 'country':
        return [data.countryName, data.countryCode].filter(Boolean).join(' · ');
      case 'province':
        return [data.province, data.provinceCode].filter(Boolean).join(' · ');
      case 'city':
        return data.city;
      case 'carrier':
        return t(`tools.ip-location.carriers.${data.carrier}`);
      case 'isp':
        return data.isp;
      case 'asn':
        return data.asn === null ? '' : `AS${data.asn}`;
      case 'timezone':
        return data.timezone;
      case 'postalCode':
        return data.postalCode;
      case 'continent':
        return data.continent;
      case 'colo':
        return data.colo;
    }
  };

  const copyText = data
    ? FIELDS.map(
        (field) => `${t(`tools.ip-location.fields.${field}`)}: ${valueOf(field) || '—'}`,
      ).join('\n')
    : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state.loading}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('tools.ip-location.refresh')}
        </button>
        <CopyButton text={copyText} label={t('tools.ip-location.copyAll')} disabled={!data} />
      </OptionBar>

      {state.loading && (
        <>
          <p role="status" className="sr-only">
            {t('tools.ip-location.loading')}
          </p>
          <div className="grid animate-pulse gap-2 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field} className="h-11 rounded-md bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
        </>
      )}

      {!state.loading && result && !result.ok && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <p>{translateToolError('tools.ip-location', result)}</p>
          {result.error === 'NOT_FOUND' && (
            <p className="mt-1 text-xs">{t('tools.ip-location.hintNotFound')}</p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const value = valueOf(field);
              return (
                <div
                  key={field}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
                    {t(`tools.ip-location.fields.${field}`)}
                  </span>
                  <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {value || '—'}
                  </code>
                  <CopyButton text={value} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('tools.ip-location.note')}</p>
        </>
      )}
    </div>
  );
}
