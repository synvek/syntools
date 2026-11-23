/**
 * Desktop shell (Tauri) helpers.
 *
 * The same bundle runs in the browser and inside the Tauri window, but only the desktop build drops the
 * OS title bar (`decorations: false` on Windows, an overlaid native title bar on macOS). Everything in here
 * therefore has to stay inert on the web: the browser must keep its own chrome and never grow a duplicate
 * set of caption buttons.
 */

export type DesktopPlatform = 'macos' | 'windows' | 'linux';

/** Whether the page runs inside the Tauri shell (the same check as `tools/rich-text-editor/pdf.ts`) */
export function isDesktop(): boolean {
  return (
    typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

let cachedPlatform: DesktopPlatform | null | undefined;

/**
 * Platform of the desktop shell, or `null` in a browser.
 *
 * Cached because the WebView user agent never changes and every header render would otherwise re-parse it.
 */
export function desktopPlatform(): DesktopPlatform | null {
  if (cachedPlatform !== undefined) return cachedPlatform;
  if (!isDesktop()) {
    cachedPlatform = null;
    return cachedPlatform;
  }
  const ua = navigator.userAgent;
  cachedPlatform =
    ua.includes('Mac OS X') || ua.includes('Macintosh')
      ? 'macos'
      : ua.includes('Windows')
        ? 'windows'
        : 'linux';
  return cachedPlatform;
}

/**
 * Window actions come from `@tauri-apps/api`, which is loaded on demand: the web build never fetches it,
 * and the desktop chunk is only pulled in when someone actually clicks a caption button.
 */
async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export async function minimizeWindow(): Promise<void> {
  if (!isDesktop()) return;
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isDesktop()) return;
  await (await currentWindow()).toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isDesktop()) return;
  await (await currentWindow()).close();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isDesktop()) return false;
  return (await currentWindow()).isMaximized();
}
