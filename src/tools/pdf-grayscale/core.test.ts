import { describe, expect, it } from 'vitest';
import * as core from './core';

describe('pdf-grayscale core', () => {
  it('exports helpers', () => {
    expect(core).toBeTruthy();
    expect(typeof core).toBe('object');
  });
});
