import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clampCrop,
  fullCrop,
  isFullCrop,
  moveCrop,
  resizeCrop,
  type CropHandle,
} from '../io/imageCrop';
import type { PdfImageCrop, PdfImageObject } from '../model/types';

interface ImageCropDialogProps {
  open: boolean;
  object: PdfImageObject | null;
  onClose(): void;
  /** `undefined` means "show the whole bitmap again" */
  onApply(crop: PdfImageCrop | undefined): void;
}

const HANDLES: Array<{ id: CropHandle; className: string }> = [
  { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { id: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { id: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
];

type DragState =
  | { mode: 'move'; startX: number; startY: number; origin: PdfImageCrop }
  | { mode: CropHandle; startX: number; startY: number; origin: PdfImageCrop };

/**
 * Image crop dialog (M3-3).
 *
 * A dialog rather than an in-canvas overlay: the crop only changes the *source* window, so it needs
 * no page coordinates, no page-size prop and no interaction with selection handles. The frame is
 * clipped by CSS and `savePdf` re-crops from the original bitmap, so the two stay pixel-identical.
 */
export function ImageCropDialog({ open, object, onClose, onApply }: ImageCropDialogProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [crop, setCrop] = useState<PdfImageCrop>(fullCrop);

  useEffect(() => {
    if (!open) return;
    setCrop(object?.crop ? clampCrop(object.crop) : fullCrop());
    dragRef.current = null;
  }, [open, object?.id, object?.crop]);

  if (!open || !object) return null;

  const begin = (event: ReactPointerEvent, mode: DragState['mode']) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: crop,
    } as DragState;
    frameRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    setCrop(
      drag.mode === 'move'
        ? moveCrop(drag.origin, dx, dy)
        : resizeCrop(drag.origin, drag.mode, dx, dy),
    );
  };

  const end = (event: ReactPointerEvent) => {
    dragRef.current = null;
    frameRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.cropTitle')}
      data-testid="pdf-crop-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.cropTitle')}
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.cropHint')}
        </p>

        <div className="flex min-h-0 justify-center overflow-auto">
          <div
            ref={frameRef}
            data-testid="pdf-crop-frame"
            className="relative inline-block touch-none select-none overflow-hidden"
            onPointerMove={onPointerMove}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <img
              src={object.dataUrl}
              alt=""
              draggable={false}
              className="block max-h-[60vh] max-w-full select-none"
            />
            <div
              data-testid="pdf-crop-rect"
              onPointerDown={(event) => begin(event, 'move')}
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle.id}
                  data-crop-handle={handle.id}
                  onPointerDown={(event) => begin(event, handle.id)}
                  className={`absolute h-3 w-3 rounded-sm border border-gray-500 bg-white ${handle.className}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-testid="pdf-crop-reset"
            onClick={() => setCrop(fullCrop())}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.cropReset')}
          </button>
          <button
            type="button"
            data-testid="pdf-crop-cancel"
            onClick={onClose}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.cropCancel')}
          </button>
          <button
            type="button"
            data-testid="pdf-crop-apply"
            onClick={() => onApply(isFullCrop(crop) ? undefined : clampCrop(crop))}
            className="rounded bg-[#b3261e] px-2 py-1 text-white hover:bg-[#8d1d17]"
          >
            {t('tools.pdfEditor.cropApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
