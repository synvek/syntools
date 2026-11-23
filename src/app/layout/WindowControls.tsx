import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  toggleMaximizeWindow,
} from '@/core/desktop/window';

// Caption buttons sit at the window edge, so no hover state may be shared between them: Tailwind orders
// hover utilities by rule position, which would let the neutral hover override the close button's red one.
const BUTTON_BASE =
  'flex h-14 w-11 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500';

const BUTTON_NEUTRAL =
  'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100';

/** Windows' own close-button red (#c42b1c), reused in both themes */
const BUTTON_CLOSE = 'text-gray-500 hover:bg-[#c42b1c] hover:text-white dark:text-gray-400';

/** Caption glyphs are drawn at their real Windows size (10px), so a 1px stroke stays crisp */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Minimize / maximize-restore / close, drawn into the app header for the desktop build.
 *
 * Windows and Linux run with `decorations: false` (see tauri.conf.json), so the native caption bar is gone
 * and these buttons replace it, flush with the window's top-right corner like VS Code. macOS keeps its own
 * traffic lights, overlaid on the header's left side, so this component is never mounted there.
 */
export function WindowControls() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      void isWindowMaximized().then((value) => {
        if (alive) setMaximized(value);
      });
    };
    sync();
    // Maximize/restore changes the viewport, so a resize listener keeps the glyph in step with the window
    window.addEventListener('resize', sync);
    return () => {
      alive = false;
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <div className="-mr-4 ml-1 flex shrink-0 items-center self-stretch">
      <button
        type="button"
        onClick={() => void minimizeWindow()}
        aria-label={t('header.minimizeAria')}
        title={t('header.minimizeAria')}
        className={`${BUTTON_BASE} ${BUTTON_NEUTRAL}`}
      >
        <Glyph>
          <path d="M0 5h10" />
        </Glyph>
      </button>
      <button
        type="button"
        onClick={() => void toggleMaximizeWindow()}
        aria-label={t(maximized ? 'header.restoreAria' : 'header.maximizeAria')}
        title={t(maximized ? 'header.restoreAria' : 'header.maximizeAria')}
        className={`${BUTTON_BASE} ${BUTTON_NEUTRAL}`}
      >
        <Glyph>
          {maximized ? (
            <>
              <rect x="0.5" y="2.5" width="7" height="7" />
              <path d="M2.5 2.5v-2h7v7h-2" />
            </>
          ) : (
            <rect x="0.5" y="0.5" width="9" height="9" />
          )}
        </Glyph>
      </button>
      <button
        type="button"
        onClick={() => void closeWindow()}
        aria-label={t('header.closeAria')}
        title={t('header.closeAria')}
        className={`${BUTTON_BASE} ${BUTTON_CLOSE}`}
      >
        <Glyph>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
        </Glyph>
      </button>
    </div>
  );
}
