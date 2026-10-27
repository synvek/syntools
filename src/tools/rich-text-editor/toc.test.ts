import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  buildTocEntries,
  collectHeadings,
  injectTocHtml,
  renderTocElement,
  renderTocHtml,
} from './toc';

/**
 * Dynamic TOC tests:
 * - Heading collection and page number computation (including level clamping)
 * - DOM structure shared by edit and export modes (screen, print, snapshot, Markdown, and Word all key off these attributes)
 * - The atom node serializes to an empty shell, so injectTocHtml must fill it before export
 */

const LABELS = { title: '目录', empty: '文档暂无标题' };
const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: createExtensions({ placeholder: '输入内容…' }),
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('collectHeadings', () => {
  it('collects heading text, level, and document position', () => {
    const editor = createEditor('<h1>引言</h1><p>正文</p><h2>背景</h2>');
    const headings = collectHeadings(editor.state.doc);
    expect(headings.map((heading) => [heading.level, heading.text])).toEqual([
      [1, '引言'],
      [2, '背景'],
    ]);
    expect(headings[0].pos).toBeLessThan(headings[1].pos);
  });

  it('skips empty headings so entries stay one-to-one', () => {
    const editor = createEditor('<h1></h1><h1>有内容</h1>');
    expect(collectHeadings(editor.state.doc).map((heading) => heading.text)).toEqual(['有内容']);
  });
});

describe('buildTocEntries', () => {
  it('takes page numbers from a callback by heading position and clamps levels to 1-6', () => {
    const editor = createEditor('<h1>一</h1><h2>二</h2>');
    const headings = collectHeadings(editor.state.doc);
    const { entries } = buildTocEntries(editor.state.doc, (pos) => (pos < headings[1].pos ? 1 : 3));
    expect(entries.map((entry) => [entry.level, entry.text, entry.page])).toEqual([
      [1, '一', 1],
      [2, '二', 3],
    ]);
  });

  it('returns no entries when there are no headings', () => {
    const editor = createEditor('<p>只有正文</p>');
    expect(buildTocEntries(editor.state.doc, () => 1).entries).toEqual([]);
  });
});

describe('renderTocElement / renderTocHtml', () => {
  const entries = [
    { level: 1, text: '引言', page: 1 },
    { level: 3, text: '细节', page: 2 },
  ];
  const headings = [
    { level: 1, text: '引言', pos: 4 },
    { level: 3, text: '细节', pos: 40 },
  ];

  it('export mode emits static markup (span + inline indent + page number)', () => {
    const element = renderTocElement(entries, headings, LABELS);
    expect(element.getAttribute('data-toc')).toBe('true');
    expect(element.querySelector('.rte-toc-title')?.textContent).toBe('目录');
    const items = Array.from(element.querySelectorAll<HTMLLIElement>('li[data-level]'));
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.rte-toc-text')?.tagName).toBe('SPAN');
    expect(items[0].style.paddingLeft).toBe('0px');
    expect(items[1].style.paddingLeft).toBe('32px');
    expect(items[1].querySelector('.rte-toc-page')?.textContent).toBe('2');
    // Export mode omits navigation info
    expect(items[0].hasAttribute('data-pos')).toBe(false);
  });

  it('edit mode emits clickable buttons with target positions', () => {
    const jumps: number[] = [];
    const element = renderTocElement(entries, headings, LABELS, (pos) => jumps.push(pos));
    const items = Array.from(element.querySelectorAll<HTMLLIElement>('li[data-level]'));
    expect(items[0].getAttribute('data-pos')).toBe('4');
    const button = items[1].querySelector('button.rte-toc-text');
    expect(button).not.toBeNull();
    (button as HTMLButtonElement).click();
    expect(jumps).toEqual([40]);
  });

  it('renders an empty-state hint when there are no headings', () => {
    const element = renderTocElement([], [], LABELS);
    expect(element.querySelector('.rte-toc-list')).toBeNull();
    expect(element.querySelector('.rte-toc-empty')?.textContent).toBe('文档暂无标题');
  });

  it('renderTocHtml returns an HTML string ready for injection', () => {
    const html = renderTocHtml(entries, headings, LABELS);
    expect(html).toContain('data-toc="true"');
    expect(html).toContain('引言');
  });
});

describe('injectTocHtml', () => {
  it('replaces empty TOC nodes with rendered content', () => {
    const html = injectTocHtml(
      '<p>前</p><div data-toc="true" class="rte-toc"></div><p>后</p>',
      renderTocHtml(
        [{ level: 1, text: '引言', page: 2 }],
        [{ level: 1, text: '引言', pos: 4 }],
        LABELS,
      ),
    );
    expect(html).toContain('rte-toc-list');
    expect(html).toContain('引言');
    expect(html).toContain('>2<');
    // The TOC node keeps data-toc so Word export still recognizes it
    expect(html).toContain('data-toc="true"');
  });

  it('returns the input unchanged without TOC nodes or rendered output', () => {
    const html = '<p>只有正文</p>';
    expect(injectTocHtml(html, '<div data-toc="true"></div>')).toBe(html);
    expect(injectTocHtml('<div data-toc="true"></div>', '')).toBe('<div data-toc="true"></div>');
  });

  it('fills in multiple TOC nodes', () => {
    const html = injectTocHtml(
      '<div data-toc="true"></div><div data-toc="true"></div>',
      renderTocHtml([], [], LABELS),
    );
    expect((html.match(/rte-toc-empty/g) ?? []).length).toBe(2);
  });
});

describe('TOC node commands', () => {
  it('serializes to an empty data-toc shell (atom) after insertion', () => {
    const editor = createEditor('<h1>引言</h1>');
    editor.commands.insertTableOfContents();
    const html = editor.getHTML();
    expect(html).toContain('data-toc="true"');
    // Atom nodes carry no content: export must go through injectTocHtml
    expect(html).not.toContain('rte-toc-list');
  });

  it('re-parses that HTML as a TOC node', () => {
    const editor = createEditor(
      '<h1>引言</h1><div data-toc="true" class="rte-toc"><p class="rte-toc-title">目录</p></div>',
    );
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableOfContents') count += 1;
    });
    expect(count).toBe(1);
  });

  it('refreshTableOfContents dispatches one transaction', () => {
    const editor = createEditor('<h1>引言</h1>');
    let updates = 0;
    editor.on('update', () => {
      updates += 1;
    });
    expect(editor.commands.refreshTableOfContents()).toBe(true);
    expect(updates).toBe(1);
  });
});
