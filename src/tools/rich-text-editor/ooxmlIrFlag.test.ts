import { describe, expect, it } from 'vitest';
import { isOoxmlIrEnabled } from './ooxmlIrFlag';

describe('isOoxmlIrEnabled (P0-2.6)', () => {
  it('turns on for 1 / true / on / yes, case-insensitively', () => {
    for (const raw of ['1', 'true', 'TRUE', ' on ', 'Yes']) {
      expect({ raw, enabled: isOoxmlIrEnabled(raw) }).toEqual({ raw, enabled: true });
    }
  });

  it('stays off for unset and falsy values', () => {
    for (const raw of [undefined, '', '0', 'false', 'off', 'no', 'enabled']) {
      expect({ raw, enabled: isOoxmlIrEnabled(raw) }).toEqual({ raw, enabled: false });
    }
  });

  it('defaults to the build flag, which is unset in this repo', () => {
    expect(import.meta.env?.VITE_USE_OOXML_IR).toBeUndefined();
    expect(isOoxmlIrEnabled()).toBe(false);
  });
});
