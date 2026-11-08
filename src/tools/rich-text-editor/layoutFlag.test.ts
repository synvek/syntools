import { describe, expect, it } from 'vitest';
import { isIncrementalLayoutEnabled } from './layoutFlag';

describe('isIncrementalLayoutEnabled (P1-5)', () => {
  it('turns on for 1 / true / on / yes, case-insensitively', () => {
    for (const raw of ['1', 'true', 'TRUE', ' on ', 'Yes']) {
      expect({ raw, enabled: isIncrementalLayoutEnabled(raw, undefined) }).toEqual({
        raw,
        enabled: true,
      });
    }
  });

  it('stays off for unset and falsy values', () => {
    for (const raw of [undefined, '', '0', 'false', 'off', 'no', 'enabled']) {
      expect({ raw, enabled: isIncrementalLayoutEnabled(raw, undefined) }).toEqual({
        raw,
        enabled: false,
      });
    }
  });

  it('lets the test override win in both directions', () => {
    // e2e compares the incremental and the full-measure path inside one build, so a boolean override
    // must be able to turn the flag on (no env) and off (env on)
    expect(isIncrementalLayoutEnabled(undefined, true)).toBe(true);
    expect(isIncrementalLayoutEnabled('1', false)).toBe(false);
    // Anything that is not a boolean is not an override
    expect(isIncrementalLayoutEnabled('1', undefined)).toBe(true);
    expect(isIncrementalLayoutEnabled(undefined, 'true')).toBe(false);
  });

  it('defaults to the build flag, which is unset in this repo', () => {
    expect(import.meta.env.VITE_INCR_LAYOUT).toBeUndefined();
    expect(isIncrementalLayoutEnabled()).toBe(false);
  });
});
