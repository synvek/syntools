import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { clampBrushSize } from './core';

const COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

/** 在线涂鸦画板 */
export default function DoodleBoardTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ c: '#0f172a', s: 4 }), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(String(init.c || '#0f172a'));
  const [size, setSize] = useState(clampBrushSize(Number(init.s) || 4));
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = Math.max(360, Math.min(520, Math.round(w * 0.6)));
      const prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      const pctx = prev.getContext('2d');
      if (pctx && canvas.width) pctx.drawImage(canvas, 0, 0);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (pctx && prev.width) ctx.drawImage(prev, 0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `doodle-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <div className="flex flex-wrap items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={`h-7 w-7 rounded-full border-2 ${
                color === c && !eraser ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.doodle.size')}
          <input
            type="range"
            min={1}
            max={32}
            value={size}
            onChange={(e) => setSize(clampBrushSize(Number(e.target.value)))}
          />
          <span className="w-6 font-mono text-xs">{size}</span>
        </label>
        <button
          type="button"
          onClick={() => setEraser((v) => !v)}
          className={`rounded-md border px-2 py-1 text-sm ${
            eraser
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          {t('tools.doodle.eraser')}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700"
        >
          {t('tools.doodle.clear')}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.doodle.download')}
        </button>
        <ShareButton getState={() => ({ c: color, s: size })} />
      </OptionBar>

      <div className="overflow-hidden rounded-md border border-gray-300 dark:border-gray-700">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const next = pos(e);
            stroke(last.current, next);
            last.current = next;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.doodle.hint')}</p>
    </div>
  );
}
