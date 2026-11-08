import { afterEach, describe, expect, it, vi } from 'vitest';
import { printSupported, printToPdf } from './pdf';
import { DEFAULT_PAGE_SETUP } from './pageSetup';

/** PDF adapter (implementation plan P0-5.2): print support detection and the text-mode print path. */

const tauriWindow = window as unknown as Record<string, unknown>;

afterEach(() => {
  vi.restoreAllMocks();
  delete tauriWindow.__TAURI_INTERNALS__;
  delete tauriWindow.__TAURI__;
});

function makeFlow(html: string): HTMLElement {
  const flow = document.createElement('div');
  flow.innerHTML = html;
  return flow;
}

/** jsdom has no layout: give each block an explicit stacked rect so pagination can be observed */
function stubRects(flow: HTMLElement, heights: number[]): void {
  let top = 0;
  Array.from(flow.children).forEach((child, index) => {
    const height = heights[index] ?? 0;
    const rect = { top, height, bottom: top + height } as DOMRect;
    (child as HTMLElement).getBoundingClientRect = () => rect;
    top += height;
  });
}

describe('printSupported', () => {
  it('reports support in a plain browser environment', () => {
    expect(printSupported()).toBe(true);
  });

  it('treats Tauri WebViews as unsupported (print() silently does nothing there)', () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    expect(printSupported()).toBe(false);

    delete tauriWindow.__TAURI_INTERNALS__;
    tauriWindow.__TAURI__ = {};
    expect(printSupported()).toBe(false);
  });
});

describe('printToPdf', () => {
  it('opens the print dialog exactly once', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    printToPdf();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('clears stale page-start markers left by a previous export', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const flow = makeFlow('<p>a</p><p>b</p>');
    // jsdom reports zero heights, so the planner emits no break — only the cleanup is observable here
    flow.children[1].setAttribute('data-page-start', 'true');

    printToPdf(flow, DEFAULT_PAGE_SETUP);

    expect(flow.children[1].hasAttribute('data-page-start')).toBe(false);
  });

  it('starts a new page after an explicit page break', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const flow = makeFlow('<p>a</p><div data-page-break="true"></div><p>b</p>');
    stubRects(flow, [100, 0, 100]);

    printToPdf(flow, DEFAULT_PAGE_SETUP);

    expect(flow.children[0].hasAttribute('data-page-start')).toBe(false);
    expect(flow.children[2].getAttribute('data-page-start')).toBe('true');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('leaves the flow alone in multi-column mode (the engine flows columns itself)', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const flow = makeFlow('<p>a</p><p>b</p>');
    const stale = 'true';
    flow.children[1].setAttribute('data-page-start', stale);

    printToPdf(flow, { ...DEFAULT_PAGE_SETUP, columns: 2 });

    expect(flow.children[1].getAttribute('data-page-start')).toBe(stale);
    expect(flow.children[0].hasAttribute('data-page-start')).toBe(false);
  });
});
