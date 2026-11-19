import { describe, expect, it } from 'vitest';
import { groupTextItems, multiplyTransform, textLineAt, type TextItemLike } from './textLines';

const PAGE = { width: 600, height: 800 };

/** Build a pdfjs-like item: `[size, 0, 0, size, x, baselineY]` in PDF space (y up) */
function item(
  str: string,
  x: number,
  baselineY: number,
  size = 12,
  width = str.length * size * 0.5,
): TextItemLike {
  return { str, transform: [size, 0, 0, size, x, baselineY], width, height: size };
}

describe('groupTextItems', () => {
  it('returns one line for a single text item with a top-left normalized rect', () => {
    const lines = groupTextItems([item('Hello', 72, 700, 12, 30)], PAGE, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
    expect(lines[0].page).toBe(3);
    expect(lines[0].fontSize).toBe(12);
    expect(lines[0].rect.x).toBeCloseTo(72 / 600, 5);
    // baseline 100 px from the top; box top is 0.85 em above it
    expect(lines[0].rect.y).toBeCloseTo((100 - 0.85 * 12) / 800, 5);
    expect(lines[0].rect.w).toBeCloseTo(30 / 600, 5);
  });

  it('separates rows by baseline and orders them top to bottom', () => {
    const lines = groupTextItems(
      [item('second', 72, 650), item('first', 72, 700), item('third', 72, 600)],
      PAGE,
    );
    expect(lines.map((line) => line.text)).toEqual(['first', 'second', 'third']);
  });

  it('joins items of one row and restores spaces from wide gaps', () => {
    const lines = groupTextItems(
      [item('Hello', 72, 700, 12, 30), item('world', 112, 701, 12, 30)],
      PAGE,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello world');
  });

  it('keeps a two-column row in reading order with a space between columns', () => {
    const lines = groupTextItems(
      [
        item('Left column', 40, 700, 10, 60),
        item('Right column', 330, 700, 10, 62),
        item('left two', 40, 686, 10, 44),
        item('right two', 330, 686, 10, 46),
      ],
      PAGE,
    );
    expect(lines.map((line) => line.text)).toEqual([
      'Left column Right column',
      'left two right two',
    ]);
    // The two-column row spans both columns
    expect(lines[0].rect.w).toBeGreaterThan(0.5);
  });

  it('rotates through the viewport transform of a 90° page', () => {
    // 600×800 page turned 90° clockwise: visual box is 800×600
    const lines = groupTextItems([item('Header', 72, 700, 12, 36)], {
      width: 800,
      height: 600,
      transform: [0, 1, -1, 0, 800, 0],
    });
    expect(lines).toHaveLength(1);
    // PDF (72,700) → visual (100,72)
    expect(lines[0].rect.x).toBeCloseTo(100 / 800, 5);
    expect(lines[0].rect.y).toBeCloseTo((72 - 0.85 * 12) / 600, 5);
    expect(lines[0].rect.w).toBeCloseTo(36 / 800, 5);
  });

  it('handles 180° rotation as a full flip', () => {
    const lines = groupTextItems([item('Flip', 100, 700, 12, 24)], {
      width: 600,
      height: 800,
      transform: [-1, 0, 0, -1, 600, 800],
    });
    // PDF (100,700) → visual (500,100)
    expect(lines[0].rect.x).toBeCloseTo(500 / 600, 5);
    expect(lines[0].rect.y).toBeCloseTo((100 - 0.85 * 12) / 800, 5);
    // Mirrored text still reads left-to-right after the transform
    expect(lines[0].text).toBe('Flip');
  });

  it('drops marked-content markers and blank rows', () => {
    const lines = groupTextItems(
      [
        { str: '', transform: [12, 0, 0, 12, 0, 0], width: 0, height: 0 },
        item('   ', 72, 700, 12, 10),
        item('real', 72, 650),
      ],
      PAGE,
    );
    expect(lines.map((line) => line.text)).toEqual(['real']);
  });

  it('ignores invalid geometry and NaN transforms', () => {
    expect(groupTextItems([item('x', 10, 10)], { width: 0, height: 0 })).toEqual([]);
    expect(
      groupTextItems(
        [{ str: 'x', transform: [NaN, 0, 0, 12, 10, 10], width: 5, height: 12 }],
        PAGE,
      ),
    ).toEqual([]);
  });

  it('clamps rects into the page', () => {
    const lines = groupTextItems([item('edge', 590, 795, 12, 40)], PAGE);
    expect(lines[0].rect.x).toBeLessThanOrEqual(1);
    expect(lines[0].rect.x + lines[0].rect.w).toBeLessThanOrEqual(1.000001);
    expect(lines[0].rect.y + lines[0].rect.h).toBeLessThanOrEqual(1.000001);
  });
});

describe('multiplyTransform', () => {
  it('applies the second matrix first', () => {
    // translate(10, 0) after scale(2)
    expect(multiplyTransform([2, 0, 0, 2, 0, 0], [1, 0, 0, 1, 10, 0])).toEqual([2, 0, 0, 2, 20, 0]);
  });
});

describe('textLineAt', () => {
  const lines = groupTextItems([item('target', 100, 700, 12, 40)], PAGE);

  it('finds the line under a point', () => {
    const { rect } = lines[0];
    expect(textLineAt(lines, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })).toBe(lines[0]);
  });

  it('returns null outside every line', () => {
    expect(textLineAt(lines, { x: 0.01, y: 0.99 })).toBeNull();
  });

  it('prefers the last (topmost) overlapping line', () => {
    const first = groupTextItems([item('a', 100, 700, 12, 40)], PAGE)[0];
    const second = { ...first, text: 'b' };
    expect(
      textLineAt([first, second], {
        x: first.rect.x + 0.001,
        y: first.rect.y + first.rect.h / 2,
      }),
    ).toBe(second);
  });
});
