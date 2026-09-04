import { describe, expect, it } from 'vitest';
import * as core from './core';

describe('pdf-sign core', () => {
  it('exports helpers', () => {
    expect(core).toBeTruthy();
    expect(typeof core).toBe('object');
  });
});
