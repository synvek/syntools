import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildLap,
  computeElapsed,
  formatStopwatch,
  type LapRecord,
} from './core';

/** 在线秒表 */
export default function StopwatchTool() {
  const { t } = useTranslation();
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const tickRef = useRef<number | null>(null);

  const running = segmentStartedAt != null;
  const elapsed = computeElapsed(baseElapsed, segmentStartedAt, now);

  useEffect(() => {
    if (!running) {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => setNow(Date.now()), 50);
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
    };
  }, [running]);

  const start = () => {
    setSegmentStartedAt(Date.now());
    setNow(Date.now());
  };

  const pause = () => {
    const total = computeElapsed(baseElapsed, segmentStartedAt, Date.now());
    setBaseElapsed(total);
    setSegmentStartedAt(null);
  };

  const reset = () => {
    setBaseElapsed(0);
    setSegmentStartedAt(null);
    setLaps([]);
    setNow(Date.now());
  };

  const lap = () => {
    const total = computeElapsed(baseElapsed, segmentStartedAt, Date.now());
    const prevTotal = laps.length > 0 ? laps[laps.length - 1].totalMs : 0;
    setLaps((prev) => [...prev, buildLap(prevTotal, total, prev.length + 1)]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900/50">
        <p
          className="font-mono text-5xl font-semibold tracking-wider text-gray-900 dark:text-gray-50 sm:text-6xl"
          aria-live="polite"
        >
          {formatStopwatch(elapsed)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {baseElapsed > 0 ? t('tools.stopwatch.resume') : t('tools.stopwatch.start')}
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {t('tools.stopwatch.pause')}
          </button>
        )}
        <button
          type="button"
          onClick={lap}
          disabled={!running}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
        >
          {t('tools.stopwatch.lap')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
        >
          {t('tools.stopwatch.reset')}
        </button>
      </div>

      {laps.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">{t('tools.stopwatch.lapIndex')}</th>
                <th className="px-3 py-2">{t('tools.stopwatch.lapTime')}</th>
                <th className="px-3 py-2">{t('tools.stopwatch.totalTime')}</th>
              </tr>
            </thead>
            <tbody>
              {[...laps].reverse().map((row) => (
                <tr
                  key={row.index}
                  className="border-t border-gray-100 font-mono dark:border-gray-800"
                >
                  <td className="px-3 py-2">{row.index}</td>
                  <td className="px-3 py-2">{formatStopwatch(row.lapMs)}</td>
                  <td className="px-3 py-2">{formatStopwatch(row.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
