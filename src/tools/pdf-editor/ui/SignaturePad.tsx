import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { readImageFile } from '../io/imageImport';

export interface SignatureImage {
  dataUrl: string;
  /** Natural size in CSS px, used as `naturalW/H` so the stamp keeps its aspect */
  width: number;
  height: number;
}

interface SignaturePadProps {
  open: boolean;
  onClose(): void;
  onApply(image: SignatureImage): void;
}

/** Logical drawing surface; the backing store is multiplied by DPR for crisp output */
const PAD_WIDTH = 480;
const PAD_HEIGHT = 180;
const EXPORT_DPR = 2;

interface Stroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

const COLORS = ['#111111', '#1d4ed8', '#b3261e'];
const WIDTHS = [2, 3, 5];

/**
 * Handwritten signature pad (M3-4).
 *
 * Pointer Events only, so a pen, a finger and a mouse behave the same. Strokes are kept as vectors
 * and replayed on every change — that is what makes undo/clear exact instead of "erase pixels".
 * The PNG is exported at 2× so a signature stays sharp at 200% zoom.
 */
export function SignaturePad({ open, onClose, onApply }: SignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [error, setError] = useState<string | null>(null);

  // A reopened dialog always starts clean
  useEffect(() => {
    if (open) return;
    setStrokes([]);
    setError(null);
    strokeRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // jsdom throws "not implemented" instead of returning null; either way there is nothing to draw
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!context) return;

    context.setTransform(EXPORT_DPR, 0, 0, EXPORT_DPR, 0, 0);
    context.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.beginPath();
      const [first, ...rest] = stroke.points;
      context.moveTo(first.x, first.y);
      for (const point of rest) context.lineTo(point.x, point.y);
      // A single tap is a dot: `stroke` alone would draw nothing
      if (rest.length === 0) context.lineTo(first.x + 0.01, first.y + 0.01);
      context.stroke();
    }
  }, [open, strokes]);

  if (!open) return null;

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const scaleX = box.width > 0 ? PAD_WIDTH / box.width : 1;
    const scaleY = box.height > 0 ? PAD_HEIGHT / box.height : 1;
    return {
      x: (event.clientX - box.left) * scaleX,
      y: (event.clientY - box.top) * scaleY,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setError(null);
    strokeRef.current = { points: [pointFromEvent(event)], color, width };
    setStrokes((current) => [...current, strokeRef.current as Stroke]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const point = pointFromEvent(event);
    stroke.points.push(point);
    // Replaying the whole stroke list on every move keeps one code path for draw/undo/clear; the
    // stroke count is tiny (signatures, not artwork)
    setStrokes((current) => [...current.slice(0, -1), { ...stroke, points: [...stroke.points] }]);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    strokeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const apply = () => {
    if (strokes.length === 0) {
      setError(t('tools.pdfEditor.signatureEmpty'));
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onApply({ dataUrl, width: PAD_WIDTH, height: PAD_HEIGHT });
      onClose();
    } catch {
      setError(t('tools.pdfEditor.err.PROCESS_FAILED'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.signatureTitle')}
      data-testid="pdf-signature-pad"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.signatureTitle')}
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.signatureTip')}
        </p>

        <canvas
          ref={canvasRef}
          width={PAD_WIDTH * EXPORT_DPR}
          height={PAD_HEIGHT * EXPORT_DPR}
          aria-label={t('tools.pdfEditor.signatureCanvas')}
          data-testid="pdf-signature-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="w-full touch-none rounded border border-dashed border-gray-300 bg-white dark:border-gray-600"
          style={{ aspectRatio: `${PAD_WIDTH} / ${PAD_HEIGHT}`, height: 'auto' }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.signatureColor')}
            <span className="flex gap-1">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value}
                  aria-pressed={color === value}
                  data-testid={`pdf-signature-color-${value.slice(1)}`}
                  onClick={() => setColor(value)}
                  className={`h-4 w-4 rounded-full border ${
                    color === value ? 'ring-2 ring-gray-500' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: value }}
                />
              ))}
            </span>
          </label>

          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.signatureWidth')}
            <select
              value={width}
              data-testid="pdf-signature-width"
              onChange={(event) => setWidth(Number(event.target.value))}
              className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {WIDTHS.map((value) => (
                <option key={value} value={value}>
                  {value} px
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            data-testid="pdf-signature-undo"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((current) => current.slice(0, -1))}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
          >
            {t('tools.pdfEditor.signatureUndo')}
          </button>
          <button
            type="button"
            data-testid="pdf-signature-clear"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
          >
            {t('tools.pdfEditor.signatureClear')}
          </button>

          {/* Image signature: a scan or a photo of a wet signature */}
          <label className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            {t('tools.pdfEditor.signatureUpload')}
            <input
              type="file"
              accept="image/*"
              data-testid="pdf-signature-upload"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void (async () => {
                  const result = await readImageFile(file);
                  if (!result.ok) {
                    setError(t(`tools.pdfEditor.err.${result.error}`));
                    return;
                  }
                  onApply({
                    dataUrl: result.value.dataUrl,
                    width: result.value.width,
                    height: result.value.height,
                  });
                  onClose();
                })();
              }}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="pdf-signature-cancel"
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.signatureCancel')}
          </button>
          <button
            type="button"
            onClick={apply}
            data-testid="pdf-signature-apply"
            className="rounded bg-[#b3261e] px-2 py-1 text-white hover:bg-[#8d1d17]"
          >
            {t('tools.pdfEditor.signatureApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
