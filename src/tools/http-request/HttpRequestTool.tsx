import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, ClearButton } from '@/core/components/ActionButtons';
import {
  formatBody,
  formatBytes,
  formatDuration,
  parseCurlCommand,
  parseHeaderLines,
  statusCategory,
  toCurl,
} from './core';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type ResponseState = {
  status: number;
  statusText: string;
  duration: number;
  size: number;
  headers: string;
  body: string;
};

const STATUS_COLOR: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  redirect: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  client: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  server: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function HttpRequestTool() {
  const { t } = useTranslation();
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ResponseState | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    setError('');
    setRes(null);
    if (!/^https?:\/\//i.test(url.trim())) {
      setError(t('tools.http-request.err.protocol'));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    setLoading(true);
    try {
      const init: RequestInit = {
        method,
        headers: Object.fromEntries(parseHeaderLines(headers).map((h) => [h.name, h.value])),
        signal: controller.signal,
      };
      if (method !== 'GET' && method !== 'HEAD' && body) init.body = body;
      const response = await fetch(url.trim(), init);
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      const pretty = formatBody(text);
      const headerLines = Array.from(response.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      setRes({
        status: response.status,
        statusText: response.statusText,
        duration: performance.now() - start,
        size: buffer.byteLength,
        headers: headerLines,
        body: pretty.ok ? pretty.value : text,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadCurl = () => {
    const parsed = parseCurlCommand(url);
    if (parsed.ok) {
      setMethod(parsed.value.method);
      setUrl(parsed.value.url);
      setHeaders(parsed.value.headers.map((h) => `${h.name}: ${h.value}`).join('\n'));
      setBody(parsed.value.body);
    } else {
      setError(t(`tools.http-request.err.${parsed.error}`));
    }
  };

  const responseText = res
    ? `HTTP/1.1 ${res.status} ${res.statusText}\n${res.headers}\n\n${res.body}`
    : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-label={t('tools.http-request.method')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            aria-label={t('tools.http-request.url')}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t('tools.http-request.send')}
          </button>
          <button
            type="button"
            onClick={loadCurl}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.http-request.fromCurl')}
          </button>
          <CopyButton
            text={toCurl({
              method,
              url,
              headers: parseHeaderLines(headers),
              body,
            })}
            label={t('tools.http-request.copyCurl')}
          />
        </div>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t('tools.http-request.headers')}
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            rows={3}
            placeholder="Accept: application/json
Authorization: Bearer ..."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t('tools.http-request.body')}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {res && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
                STATUS_COLOR[statusCategory(res.status)] ?? STATUS_COLOR.unknown
              }`}
            >
              {res.status} {res.statusText}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.http-request.duration')}: {formatDuration(res.duration)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.http-request.size')}: {formatBytes(res.size)}
            </span>
            <CopyButton text={responseText} />
            <DownloadButton content={responseText} filename="response.txt" />
            <ClearButton onClick={() => setRes(null)} />
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm dark:border-gray-700 dark:bg-gray-800">
            {responseText}
          </pre>
        </div>
      )}
    </div>
  );
}
