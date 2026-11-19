import { useTranslation } from 'react-i18next';
import { STAMP_COLORS, STAMP_KEYS, STAMP_LABEL_KEYS, type StampKey } from '../io/stampImage';

interface StampGalleryProps {
  open: boolean;
  onClose(): void;
  /** The controller rasterizes the preset and places it on the current page */
  onPick(key: StampKey): void;
}

/**
 * Preset stamp picker.
 *
 * The preview is CSS-only (a bordered box with the label) instead of a pre-rendered PNG, so the
 * gallery works before the first canvas exists and matches the system font of the UI.
 */
export function StampGallery({ open, onClose, onPick }: StampGalleryProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.stampTitle')}
      data-testid="pdf-stamp-gallery"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.stampTitle')}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {STAMP_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              data-testid={`pdf-stamp-${key}`}
              onClick={() => {
                onPick(key);
                onClose();
              }}
              className="flex h-20 items-center justify-center rounded border-2 bg-white p-2 transition-transform motion-reduce:transition-none hover:scale-[1.02]"
              style={{ borderColor: STAMP_COLORS[key], color: STAMP_COLORS[key] }}
            >
              <span
                className="flex h-full w-full items-center justify-center border-2 text-center text-sm font-bold tracking-wide"
                style={{ borderColor: STAMP_COLORS[key] }}
              >
                {t(`tools.pdfEditor.${STAMP_LABEL_KEYS[key]}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="pdf-stamp-close"
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.stampClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
