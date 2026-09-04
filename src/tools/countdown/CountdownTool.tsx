import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  formatCountdown,
  parseCountdownDuration,
  remainingMs,
} from './core';

/** 在线倒计时器 */
export default function CountdownTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ h: 0, m: 5, s: 0 }), []);
  const [hours, setHours] = useState(Number(init.h) || 0);
  const [minutes, setMinutes] = useState(Number(init.m) || 0);
  const [seconds, setSeconds] = useState(Number(init.s) || 0);

  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const tickRef = useRef<number | null>(null);

  const duration = useMemo(
    () => parseCountdownDuration(hours, minutes, seconds),
    [hours, minutes, seconds],
  );

  useEffect(() => {
    if (!running || endAt == null) {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    const tick = () => {
      const left = remainingMs(endAt, Date.now());
      setDisplayMs(left);
      if (left <= 0) {
        setRunning(false);
        setEndAt(null);
        setPausedLeft(null);
        setFinished(true);
      }
    };
    tick();
    tickRef.current = window.setInterval(tick, 200);
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
    };
  }, [running, endAt]);

  const start = () => {
    const base =
      pausedLeft != null
        ? pausedLeft
        : duration.ok
          ? duration.value
          : 0;
    if (base <= 0) return;
    setFinished(false);
    setEndAt(Date.now() + base);
    setPausedLeft(null);
    setRunning(true);
  };

  const pause = () => {
    if (endAt == null) return;
    const left = remainingMs(endAt, Date.now());
    setPausedLeft(left);
    setDisplayMs(left);
    setEndAt(null);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setEndAt(null);
    setPausedLeft(null);
    setFinished(false);
    setDisplayMs(duration.ok ? duration.value : 0);
  };

  // 未运行时跟随时长输入预览
  useEffect(() => {
    if (running || pausedLeft != null) return;
    setDisplayMs(duration.ok ? duration.value : 0);
  }, [duration, running, pausedLeft]);

  const shown = formatCountdown(
    running || pausedLeft != null ? displayMs : duration.ok ? duration.value : 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.countdown.hours')}
          <input
            type="number"
            min={0}
            max={99}
            value={hours}
            disabled={running || pausedLeft != null}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.countdown.minutes')}
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            disabled={running || pausedLeft != null}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.countdown.seconds')}
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            disabled={running || pausedLeft != null}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ShareButton getState={() => ({ h: hours, m: minutes, s: seconds })} />
      </OptionBar>

      {!duration.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.countdown.err.${duration.error}`)}
        </p>
      )}

      <div
        className={`rounded-md border px-6 py-10 text-center ${
          finished
            ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'
        }`}
      >
        <p
          className="font-mono text-5xl font-semibold tracking-wider text-gray-900 dark:text-gray-50 sm:text-6xl"
          aria-live="polite"
        >
          {shown}
        </p>
        {finished && (
          <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
            {t('tools.countdown.done')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={!duration.ok && pausedLeft == null}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {pausedLeft != null ? t('tools.countdown.resume') : t('tools.countdown.start')}
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {t('tools.countdown.pause')}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
        >
          {t('tools.countdown.reset')}
        </button>
      </div>
    </div>
  );
}
