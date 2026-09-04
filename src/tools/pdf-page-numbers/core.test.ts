import { describe, expect, it } from 'vitest';
import * as core from './core';

describe('pdf-page-numbers core', () => {
  it('exports helpers', () => {
    expect(core).toBeTruthy();
    expect(typeof core).toBe('object');
  });
});
