import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton } from '@/core/components/ActionButtons';
import {
  closeCodeText,
  decodePayload,
  encodePayload,
  nextLogId,
  validateWsUrl,
  type LogEntry,
  type PayloadMode,
} from './core';

const MODES: PayloadMode[] = ['text', 'hex', 'base64'];

export default function WebsocketTesterTool() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('wss://echo.websocket.events');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<PayloadMode>('text');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const push = (direction: LogEntry['direction'], text: string) =>
    setLogs((prev) => [...prev, { id: nextLogId(), direction, text, at: Date.now() }]);

  const connect = () => {
    const check = validateWsUrl(url);
    if (!check.ok) {
      setStatus(t(`tools.websocket-tester.err.${check.error}`));
      return;
    }
    setStatus(t('tools.websocket-tester.connecting'));
    const ws = new WebSocket(check.value.url);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setStatus(t('tools.websocket-tester.open'));
      push('system', `OPEN ${check.value.url}`);
    };
    ws.onmessage = (ev) => push('received', decodePayload(ev.data, mode));
    ws.onerror = () => push('system', 'ERROR');
    ws.onclose = (ev) => {
      setConnected(false);
      setStatus(
        `${t('tools.websocket-tester.closed')} ${ev.code ? `${ev.code} ${closeCodeText(ev.code)}` : ''}`,
      );
      push('system', `CLOSE ${ev.code} ${closeCodeText(ev.code)}`);
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  const send = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const encoded = encodePayload(message, mode);
    if (!encoded.ok) {
      push('system', `ERROR: ${encoded.error}`);
      return;
    }
    ws.send(encoded.value as string | ArrayBufferLike);
    push(
      'sent',
      mode === 'text' ? message : JSON.stringify(Array.from(encoded.value as Uint8Array)),
    );
    setMessage('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="wss://..."
          aria-label={t('tools.websocket-tester.url')}
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        {!connected ? (
          <button
            type="button"
            onClick={connect}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t('tools.websocket-tester.connect')}
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('tools.websocket-tester.disconnect')}
          </button>
        )}
      </div>

      {status && <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as PayloadMode)}
          aria-label={t('tools.websocket-tester.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('tools.websocket-tester.message')}
          aria-label={t('tools.websocket-tester.message')}
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={send}
          disabled={!connected}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t('tools.websocket-tester.send')}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {t('tools.websocket-tester.log')}
        </h2>
        <ClearButton onClick={() => setLogs([])} disabled={logs.length === 0} />
      </div>

      <ul className="flex max-h-80 flex-col gap-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-800">
        {logs.length === 0 && <li className="text-gray-400 dark:text-gray-500">—</li>}
        {logs.map((log) => (
          <li key={log.id} className="flex gap-2">
            <span
              className={
                log.direction === 'sent'
                  ? 'text-blue-600 dark:text-blue-400'
                  : log.direction === 'received'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500'
              }
            >
              [{log.direction}]
            </span>
            <span className="break-all">{log.text}</span>
          </li>
        ))}
      </ul>
      {logs.length > 0 && (
        <CopyButton text={logs.map((l) => `[${l.direction}] ${l.text}`).join('\n')} />
      )}
    </div>
  );
}
