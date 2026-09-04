import { describe, expect, it } from 'vitest';
import {
  ANNOTATE_TOOLS,
  draftToPdfAnnotation,
  normToPdfPoint,
  toNorm,
  fromNorm,
  type AnnotateDraft,
} from './core';

const display = { width: 200, height: 100 };
const pageSize = { width: 400, height: 200 };

describe('pdf-annotate core', () => {
  it('lists visual tools', () => {
    expect(ANNOTATE_TOOLS).toEqual([
      'pen',
      'highlight',
      'rect',
      'ellipse',
      'circle',
      'line',
      'text',
    ]);
  });

  it('normalizes screen points and maps to PDF', () => {
    expect(toNorm(0, 0, display)).toEqual({ x: 0, y: 0 });
    expect(toNorm(200, 100, display)).toEqual({ x: 1, y: 1 });
    expect(fromNorm(0.5, 0.5, display)).toEqual({ x: 100, y: 50 });
    expect(normToPdfPoint(0, 0, pageSize)).toEqual({ x: 0, y: 200 });
    expect(normToPdfPoint(1, 1, pageSize)).toEqual({ x: 400, y: 0 });
  });

  it('converts highlight draft to PDF bottom-left box', () => {
    const draft: AnnotateDraft = {
      id: '1',
      kind: 'highlight',
      pageIndex: 0,
      x: 0.05,
      y: 0.2,
      width: 0.2,
      height: 0.1,
      color: '#facc15',
      strokeWidth: 1,
    };
    const a = draftToPdfAnnotation(draft, display, pageSize);
    expect(a.kind).toBe('highlight');
    if (a.kind !== 'highlight') return;
    expect(a.x).toBeCloseTo(20);
    expect(a.y).toBeCloseTo(140);
    expect(a.width).toBeCloseTo(80);
    expect(a.height).toBeCloseTo(20);
  });

  it('converts ellipse/circle/pen/text drafts', () => {
    const ellipse = draftToPdfAnnotation(
      {
        id: 'e',
        kind: 'ellipse',
        pageIndex: 0,
        x: 0.25,
        y: 0.25,
        width: 0.5,
        height: 0.5,
        color: '#3b82f6',
        strokeWidth: 2,
      },
      display,
      pageSize,
    );
    expect(ellipse.kind).toBe('ellipse');
    if (ellipse.kind === 'ellipse') {
      expect(ellipse.x).toBeCloseTo(200);
      expect(ellipse.y).toBeCloseTo(100);
      expect(ellipse.width).toBeCloseTo(100);
      expect(ellipse.height).toBeCloseTo(50);
    }

    const circle = draftToPdfAnnotation(
      {
        id: 'c',
        kind: 'circle',
        pageIndex: 0,
        x: 0.25,
        y: 0.25,
        width: 0.5,
        height: 0.5,
        color: '#22c55e',
        strokeWidth: 2,
      },
      display,
      pageSize,
    );
    expect(circle.kind).toBe('circle');
    if (circle.kind === 'circle') {
      expect(circle.width).toBe(circle.height);
      expect(circle.width).toBeCloseTo(100);
    }

    const pen = draftToPdfAnnotation(
      {
        id: 'p',
        kind: 'pen',
        pageIndex: 0,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: '#ef4444',
        strokeWidth: 3,
      },
      display,
      pageSize,
    );
    expect(pen.kind).toBe('pen');
    if (pen.kind === 'pen') {
      expect(pen.points[0]).toEqual({ x: 0, y: 200 });
      expect(pen.points[1]).toEqual({ x: 400, y: 0 });
    }

    const text = draftToPdfAnnotation(
      {
        id: 't',
        kind: 'text',
        pageIndex: 0,
        x: 0.05,
        y: 0.2,
        text: 'Hi',
        fontSize: 16,
        color: '#111',
      },
      display,
      pageSize,
    );
    expect(text.kind).toBe('text');
    if (text.kind === 'text') {
      expect(text.x).toBeCloseTo(20);
      expect(text.fontSize).toBeCloseTo(32);
      const baselineNy = 0.2 + 16 / display.height;
      expect(text.y).toBeCloseTo((1 - baselineNy) * pageSize.height);
    }
  });
});
