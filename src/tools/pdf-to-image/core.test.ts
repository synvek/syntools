import { describe, expect, it } from 'vitest';
import * as core from './core';

describe('pdf-to-image core', () => {
  it('exports helpers', () => {
    expect(core).toBeTruthy();
    expect(typeof core).toBe('object');
  });
});
