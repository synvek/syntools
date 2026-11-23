import { afterEach, describe, expect, it, vi } from 'vitest';

/** Desktop shell helpers: platform detection and the "do nothing in a browser" guarantee. */

const tauriWindow = window as unknown as Record<string, unknown>;

/** The platform is cached per module instance, so every case loads a fresh copy */
async function loadModule() {
  vi.resetModules();
  return import('./window');
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

afterEach(() => {
  delete tauriWindow.__TAURI_INTERNALS__;
  delete tauriWindow.__TAURI__;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  vi.resetModules();
});

describe('desktopPlatform', () => {
  it('is null in a browser, even on a Mac or Windows user agent', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    const { desktopPlatform } = await loadModule();
    expect(desktopPlatform()).toBeNull();
  });

  it('maps the Tauri WebView user agent to the platform', async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};

    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    expect((await loadModule()).desktopPlatform()).toBe('macos');

    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect((await loadModule()).desktopPlatform()).toBe('windows');

    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15');
    expect((await loadModule()).desktopPlatform()).toBe('linux');
  });
});

describe('window actions outside the desktop shell', () => {
  it('stay inert instead of loading the Tauri API', async () => {
    const mod = await loadModule();
    await expect(mod.minimizeWindow()).resolves.toBeUndefined();
    await expect(mod.toggleMaximizeWindow()).resolves.toBeUndefined();
    await expect(mod.closeWindow()).resolves.toBeUndefined();
    await expect(mod.isWindowMaximized()).resolves.toBe(false);
  });
});
