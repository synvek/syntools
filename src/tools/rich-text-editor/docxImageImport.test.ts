import { describe, expect, it } from 'vitest';
import { applyImageBoxes, parseDocxImageBoxes } from './docxImageImport';

/**
 * Image sizing across import: mammoth drops `wp:extent`, so Word's rendered size (and the wrap mode)
 * have to be read back from `word/document.xml` and stamped onto the `<img>` elements.
 */

const inline = (cx: number, cy: number): string =>
  `<w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><a:graphic><a:graphicData><pic:pic>` +
  `<pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;

const anchor = (cx: number, cy: number, body: string, behind = '0'): string =>
  `<w:drawing><wp:anchor behindDoc="${behind}"><a:blip r:embed="rId1"/>${body}` +
  `<wp:extent cx="${cx}" cy="${cy}"/></wp:anchor></w:drawing>`;

const wrapSquare = (wrapText: string, offset: number): string =>
  `<wp:wrapSquare wrapText="${wrapText}"/><wp:positionH relativeFrom="column"><wp:posOffset>${offset}</wp:posOffset></wp:positionH>`;

const documentXml = (paragraphs: string): string =>
  `<w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:pic="pic"><w:body>${paragraphs}</w:body></w:document>`;

describe('parseDocxImageBoxes', () => {
  it('reads the rendered size of an inline picture in px', () => {
    const boxes = parseDocxImageBoxes(documentXml(`<w:p>${inline(822960, 822960)}</w:p>`));
    // 822960 EMU = 86.4px: Word shows the 320px logo at 86px
    expect(boxes).toEqual([{ width: 86, height: 86, layer: 'inline' }]);
  });

  it('maps square wrapping to the side the picture floats to', () => {
    // wrapText names the side that keeps text: "left" means the picture sits on the right
    const left = anchor(2377440, 1527048, wrapSquare('left', 3108960));
    const both = anchor(2834640, 1773936, wrapSquare('bothSides', 2880360));
    const boxes = parseDocxImageBoxes(documentXml(`<w:p>${left}</w:p><w:p>${both}</w:p>`));
    expect(boxes.map((box) => box.layer)).toEqual(['wrap-right', 'wrap-right']);
  });

  it('keeps top-and-bottom wrapping', () => {
    const topBottom = anchor(2651760, 1700784, '<wp:wrapTopAndBottom/>');
    const boxes = parseDocxImageBoxes(documentXml(`<w:p>${topBottom}</w:p>`));
    expect(boxes.map((box) => box.layer)).toEqual(['top-bottom']);
  });

  it("places an out-of-flow picture that is anchored to the page at Word's offset", () => {
    // behindDoc = painted under the text; `relativeFrom="page"` is measured from the paper edge, so the
    // 1440twip (96px) margin is subtracted to reach the text area's origin
    const position =
      '<wp:positionH relativeFrom="page"><wp:posOffset>952500</wp:posOffset></wp:positionH>' +
      '<wp:positionV relativeFrom="page"><wp:posOffset>1905000</wp:posOffset></wp:positionV>';
    const behind = anchor(1554480, 996696, `<wp:wrapNone/>${position}`, '1');
    const [box] = parseDocxImageBoxes(documentXml(`<w:p>${behind}</w:p>`));
    expect(box?.layer).toBe('behind');
    // 952500 EMU = 100px, 1905000 EMU = 200px
    expect([box?.offsetX, box?.offsetY]).toEqual([4, 104]);
  });

  it('resolves a named alignment of a wrapNone picture (front layer)', () => {
    const position =
      '<wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH>' +
      '<wp:positionV relativeFrom="page"><wp:align>top</wp:align></wp:positionV>';
    const front = anchor(1554480, 996696, `<wp:wrapNone/>${position}`);
    const [box] = parseDocxImageBoxes(documentXml(`<w:p>${front}</w:p>`));
    expect(box?.layer).toBe('front');
    // Centred on the 793.73px page: (793.73 − 163) / 2 = 315.37, minus the 96px left margin
    expect(box?.offsetX).toBe(219);
    // "top of the page" is inside the top margin, so the offset clamps to the text area's edge
    expect(box?.offsetY).toBe(0);
  });

  it('anchors a paragraph-relative offset to the paragraph, not to the end of the line box', () => {
    // `relativeFrom="paragraph"` is measured from the anchor paragraph's corner — reproducible with
    // `data-anchor`. Treating it as unknown left the offset unapplied, so a "behind the text" logo
    // collapsed to the end of the paragraph's line box, i.e. underneath the big in-flow picture above
    // it, and disappeared.
    const behind = anchor(
      1554480,
      996696,
      '<wp:wrapNone/><wp:positionH relativeFrom="column"><wp:posOffset>2242128</wp:posOffset></wp:positionH>' +
        '<wp:positionV relativeFrom="paragraph"><wp:posOffset>-571500</wp:posOffset></wp:positionV>',
      '1',
    );
    const [box] = parseDocxImageBoxes(documentXml(`<w:p>${behind}</w:p>`));
    expect(box?.layer).toBe('behind');
    expect(box?.anchor).toBe('paragraph');
    // 2242128 EMU = 235px, -571500 EMU = -60px: a paragraph-relative offset may be negative
    expect([box?.offsetX, box?.offsetY]).toEqual([235, -60]);
  });

  it('keeps the layer and leaves only the unresolvable axis at its static position', () => {
    // `relativeFrom="line"` needs the text layout Word computed. Dropping to top-bottom would turn a
    // "behind text" logo into a block that pushes the text away, so the layer stays and `top` is left
    // unset: the browser then keeps the picture where the anchor paragraph put it.
    const behind = anchor(
      1554480,
      996696,
      '<wp:wrapNone/><wp:positionH relativeFrom="line"><wp:posOffset>2242128</wp:posOffset></wp:positionH>' +
        '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
      '1',
    );
    const [box] = parseDocxImageBoxes(documentXml(`<w:p>${behind}</w:p>`));
    expect(box?.layer).toBe('behind');
    // A paragraph-relative Y still makes the paragraph the containing block, but X is unknown
    expect(box?.anchor).toBe('paragraph');
    expect(box?.offsetX).toBeUndefined();
    expect(box?.offsetY).toBe(0);
  });

  it('ignores shapes (a wps:wsp produces no <img>) and the duplicated mc:Fallback branch', () => {
    const shape =
      '<w:drawing><wp:inline><wp:extent cx="1000000" cy="1000000"/><a:graphic><a:graphicData>' +
      '<wps:wsp><wps:spPr><a:xfrm><a:ext cx="1000000" cy="1000000"/></a:xfrm></wps:spPr></wps:wsp>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing>';
    const alternate =
      '<mc:AlternateContent><mc:Choice>' +
      inline(822960, 822960) +
      '</mc:Choice><mc:Fallback>' +
      inline(822960, 822960) +
      '</mc:Fallback></mc:AlternateContent>';
    const boxes = parseDocxImageBoxes(documentXml(`<w:p>${shape}</w:p><w:p>${alternate}</w:p>`));
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.width).toBe(86);
  });

  it('returns nothing for a document without drawings', () => {
    expect(parseDocxImageBoxes(documentXml('<w:p><w:r><w:t>x</w:t></w:r></w:p>'))).toEqual([]);
  });
});

describe('applyImageBoxes', () => {
  const boxes = [
    { width: 86, height: 86, layer: 'inline' as const },
    { width: 298, height: 186, layer: 'wrap-left' as const },
  ];

  it('stamps width / height and the wrap mode onto the pictures in order', () => {
    const html = '<p><img src="a.png"></p><p><img src="b.png"></p>';
    const result = applyImageBoxes(html, boxes);
    expect(result).toContain('width="86"');
    expect(result).toContain('height="86"');
    expect(result).toContain('style="width: 86px; height: 86px"');
    expect(result).toContain('data-layer="wrap-left"');
    // Inline is the default: it writes no data-layer
    expect(result.match(/data-layer/g)).toHaveLength(1);
  });

  it('writes the absolute offset of a floating layer (left / top)', () => {
    const html = '<p><img src="a.png"></p>';
    const result = applyImageBoxes(html, [
      { width: 163, height: 105, layer: 'behind', offsetX: 4, offsetY: 104 },
    ]);
    expect(result).toContain('data-layer="behind"');
    expect(result).toContain('left: 4px; top: 104px');
    expect(result).not.toContain('data-anchor');
  });

  it('marks a paragraph-anchored picture so the paragraph becomes its containing block', () => {
    const html = '<p><img src="a.png"></p>';
    const result = applyImageBoxes(html, [
      { width: 163, height: 105, layer: 'behind', offsetX: 235, offsetY: -60, anchor: 'paragraph' },
    ]);
    expect(result).toContain('data-anchor="paragraph"');
    expect(result).toContain('left: 235px; top: -60px');
  });

  it('leaves the HTML alone when the picture counts disagree', () => {
    const html = '<p><img src="a.png"></p>';
    expect(applyImageBoxes(html, boxes)).toBe(html);
  });

  it('is a no-op without boxes', () => {
    const html = '<p><img src="a.png"></p>';
    expect(applyImageBoxes(html, [])).toBe(html);
  });
});
