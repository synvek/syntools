import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Analytics contract tests.
 *
 * The promise on /privacy is not "we collect little", it is "these exact fields, and nothing else".
 * So these tests pin the two things that could silently break that promise:
 *   1. collection stays off / respects DNT, and batching still delivers when it is on;
 *   2. tool errors and searches never carry user content — only a de-identified signature.
 */

type AnalyticsModule = typeof import('./index');

const beacon = vi.fn(() => true);
const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 204 } as unknown as Response));

/**
 * Payload capture: jsdom's Blob has no `text()` and FileReader does not resolve under fake timers,
 * so the body string is recorded when the collector builds the Blob.
 */
const RealBlob = globalThis.Blob;
const sentPayloads: string[] = [];
class CapturingBlob extends RealBlob {
  constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
    super(parts, options);
    const first = parts?.[0];
    sentPayloads.push(typeof first === 'string' ? first : '');
  }
}

/** ENDPOINT is read once at module load, so every case needs a fresh module instance */
async function loadAnalytics(endpoint: string): Promise<AnalyticsModule> {
  vi.resetModules();
  vi.stubEnv('VITE_ANALYTICS_ENDPOINT', endpoint);
  return import('./index');
}

interface Payload {
  sid: string;
  lng: string;
  events: { n: string; p?: Record<string, string | number | boolean>; t: number }[];
}

/** Read back what a sendBeacon call would have posted */
function payloadOf(index = 0): Payload {
  const raw = sentPayloads[index];
  if (raw === undefined) throw new Error(`no beacon call at index ${index}`);
  return JSON.parse(raw) as Payload;
}

beforeEach(() => {
  vi.useFakeTimers();
  sentPayloads.length = 0;
  beacon.mockClear();
  fetchMock.mockClear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'sendBeacon', {
    value: beacon,
    configurable: true,
    writable: true,
  });
  vi.stubGlobal('Blob', CapturingBlob);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'doNotTrack', { value: undefined, configurable: true });
});

describe('gating', () => {
  it('is a no-op when no endpoint is configured', async () => {
    const analytics = await loadAnalytics('');
    expect(analytics.analyticsEnabled).toBe(false);

    analytics.track('page_view', { page: 'home' });
    vi.advanceTimersByTime(60_000);

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops collecting when the browser sends DNT', async () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const analytics = await loadAnalytics('/api/event');

    analytics.track('page_view', { page: 'home' });
    vi.advanceTimersByTime(60_000);

    expect(beacon).not.toHaveBeenCalled();
  });
});

describe('batching', () => {
  it('delivers a full batch immediately', async () => {
    const analytics = await loadAnalytics('/api/event');
    expect(analytics.analyticsEnabled).toBe(true);

    for (let i = 0; i < 8; i++) analytics.track('tool_open', { id: `tool-${i}` });

    expect(beacon).toHaveBeenCalledTimes(1);
    const payload = payloadOf();
    expect(payload.events).toHaveLength(8);
    expect(payload.events[0].n).toBe('tool_open');
    expect(payload.events[0].p).toEqual({ id: 'tool-0' });
    expect(payload.lng).toBeTruthy();
  });

  it('flushes a partial batch on the timer and reuses the session id', async () => {
    const analytics = await loadAnalytics('/api/event');

    analytics.track('page_view', { page: 'home' });
    expect(beacon).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(beacon).toHaveBeenCalledTimes(1);
    const first = payloadOf(0);

    analytics.track('tool_open', { id: 'json-format' });
    vi.advanceTimersByTime(10_000);
    expect(beacon).toHaveBeenCalledTimes(2);
    const second = payloadOf(1);

    expect(second.sid).toBe(first.sid);
    expect(second.events).toHaveLength(1);
  });

  it('drops durations under one second as misclicks', async () => {
    const analytics = await loadAnalytics('/api/event');

    analytics.trackToolDuration('json-format', 400);
    vi.advanceTimersByTime(60_000);
    expect(beacon).not.toHaveBeenCalled();

    analytics.trackToolDuration('json-format', 5_000);
    vi.advanceTimersByTime(10_000);
    expect(beacon).toHaveBeenCalledTimes(1);
    const payload = payloadOf();
    expect(payload.events[0].p).toEqual({ id: 'json-format', ms: 5_000 });
  });
});

describe('de-identification', () => {
  it('strips quoted values, file names and digits from error text when enabled', async () => {
    const analytics = await loadAnalytics('/api/event');
    const clean = analytics.normalizeErrorSignature(
      'Failed to parse "客户合同正文第3页" from 季度报告.docx at offset 12345 after 2 retries',
    );

    expect(clean).not.toContain('客户合同正文');
    expect(clean).not.toContain('季度报告.docx');
    expect(clean).not.toContain('12345');
    expect(clean).toContain('‹file›');
    expect(clean.length).toBeLessThanOrEqual(60);
  });

  it('caps the signature even for long messages', async () => {
    const analytics = await loadAnalytics('/api/event');
    expect(analytics.normalizeErrorSignature('x'.repeat(500))).toHaveLength(60);
    expect(analytics.normalizeErrorSignature(undefined)).toBe('');
  });

  it('reports the error type and tool id, never the message body', async () => {
    const analytics = await loadAnalytics('/api/event');

    analytics.trackToolOpen('json-format');
    analytics.trackToolError(
      new TypeError('Unexpected token "<secret user payload>" at position 7'),
    );
    vi.advanceTimersByTime(10_000);

    const payload = payloadOf();
    const event = payload.events.find((e) => e.n === 'tool_error');
    expect(event?.p?.err).toBe('TypeError');
    expect(event?.p?.id).toBe('json-format');
    expect(event?.p?.sig).toContain('″');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('sends search length and result count, never the query', async () => {
    const analytics = await loadAnalytics('/api/event');

    analytics.trackSearchUse(9, 0, 'key');
    vi.advanceTimersByTime(10_000);

    const payload = payloadOf();
    expect(payload.events[0].n).toBe('search_use');
    expect(payload.events[0].p).toEqual({ len: 9, res: 0, via: 'key' });
    expect(JSON.stringify(payload)).not.toContain('query');
  });
});
