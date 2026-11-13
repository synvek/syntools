import { describe, expect, it } from 'vitest';
import { convertDocxNotes } from './docxNotesImport';

/**
 * Footnotes / endnotes across import: mammoth emits a static “[1]” plus a trailing list, while the
 * editor stores a self-contained atom on the reference. Both halves have to be rewritten together.
 */

describe('convertDocxNotes', () => {
  it('turns the reference and the trailing list into note atoms', () => {
    const html =
      '<p>正文<sup><a href="#footnote-1" id="footnote-ref-1">[1]</a></sup>续</p>' +
      '<ol><li id="footnote-1"><p>脚注说明 <a href="#footnote-ref-1">↑</a></p></li></ol>';
    const result = convertDocxNotes(html);
    expect(result).toContain('data-footnote="true"');
    expect(result).toContain('data-note="脚注说明"');
    // The back-link (↑) must not end up in the note text
    expect(result).not.toContain('↑');
    // The list only carried note bodies: it is gone
    expect(result).not.toContain('<ol>');
    expect(result).toContain('正文');
  });

  it('handles endnotes with their own attribute', () => {
    const html =
      '<p>正文<sup><a href="#endnote-1">[1]</a></sup></p>' +
      '<ol><li id="endnote-1"><p>尾注说明</p></li></ol>';
    const result = convertDocxNotes(html);
    expect(result).toContain('data-endnote="true"');
    expect(result).toContain('data-note="尾注说明"');
    expect(result).not.toContain('<ol>');
  });

  it('leaves ordinary superscripts and unrelated lists alone', () => {
    const html = '<p><sup>上标</sup></p><ol><li>普通条目</li></ol>';
    expect(convertDocxNotes(html)).toBe(html);
  });

  it('keeps a list that mixes note bodies with ordinary items', () => {
    const html =
      '<p>正文<sup><a href="#footnote-1">[1]</a></sup></p>' +
      '<ol><li id="footnote-1"><p>说明</p></li><li>普通条目</li></ol>';
    const result = convertDocxNotes(html);
    expect(result).toContain('data-note="说明"');
    expect(result).toContain('普通条目');
  });

  it('does not touch markup without notes', () => {
    const html = '<p>正文</p>';
    expect(convertDocxNotes(html)).toBe(html);
  });
});
