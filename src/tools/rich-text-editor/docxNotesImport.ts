/**
 * Footnotes / endnotes ← mammoth's HTML shape (import side).
 *
 * mammoth reads `word/footnotes.xml` and `word/endnotes.xml` and outputs the notes as
 * `<sup><a href="#footnote-1">[1]</a></sup>` in the body plus an `<ol><li id="footnote-1">…</li></ol>`
 * list at the very end of the document. The editor models a note as a self-contained inline atom
 * (`<sup data-footnote="true" data-note="…"></sup>`, see `footnotes.ts`), so neither half is usable
 * as-is: the reference shows a static “[1]” instead of the editor's numbered marker, and the note
 * text ends up as a stray list at the bottom of the page instead of at the page bottom.
 *
 * The conversion is a plain rewrite of that pair, keyed by the ids mammoth already wrote.
 */

const NOTE_ID_RE = /^(footnote|endnote)-(.+)$/;

interface NoteDefinition {
  kind: 'footnote' | 'endnote';
  text: string;
}

/** `data-*` attribute and class the editor's note node expects */
const NOTE_ATTR: Record<NoteDefinition['kind'], { attr: string; className: string }> = {
  footnote: { attr: 'data-footnote', className: 'rte-footnote-ref' },
  endnote: { attr: 'data-endnote', className: 'rte-endnote-ref' },
};

/**
 * Rewrite mammoth's reference + trailing list into the editor's note atoms.
 * Returns the HTML unchanged when there is nothing to convert.
 */
export function convertDocxNotes(html: string): string {
  if (!html.includes('footnote-') && !html.includes('endnote-')) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  // 1) Note bodies: `<li id="footnote-1">`. The back-link (`↑`) is mammoth's own anchor to the body
  const definitions = new Map<string, NoteDefinition>();
  for (const item of Array.from(doc.body.querySelectorAll('li[id]'))) {
    const match = NOTE_ID_RE.exec(item.getAttribute('id') ?? '');
    if (!match) continue;
    const clone = item.cloneNode(true) as HTMLElement;
    for (const link of Array.from(clone.querySelectorAll('a'))) link.remove();
    definitions.set(item.getAttribute('id') as string, {
      kind: match[1] as NoteDefinition['kind'],
      text: (clone.textContent ?? '').replace(/\u00a0/g, ' ').trim(),
    });
  }
  if (definitions.size === 0) return html;

  // 2) References: `<sup><a href="#footnote-1">[1]</a></sup>` -> the editor's atom
  for (const sup of Array.from(doc.body.querySelectorAll('sup'))) {
    const link = sup.querySelector('a[href^="#"]');
    const target = link?.getAttribute('href')?.slice(1);
    if (!link || !target) continue;
    const definition = definitions.get(target);
    if (!definition) continue;
    const replacement = doc.createElement('sup');
    const { attr, className } = NOTE_ATTR[definition.kind];
    replacement.setAttribute(attr, 'true');
    replacement.setAttribute('class', className);
    replacement.setAttribute('data-note', definition.text);
    sup.replaceWith(replacement);
  }

  // 3) The trailing list only carried the note bodies: drop it (a list that still has ordinary items stays)
  for (const list of Array.from(doc.body.querySelectorAll('ol, ul'))) {
    const items = Array.from(list.children).filter((child) => child.tagName === 'LI');
    if (items.length === 0) continue;
    const allNotes = items.every((item) => NOTE_ID_RE.test(item.getAttribute('id') ?? ''));
    if (allNotes) list.remove();
  }

  return doc.body.innerHTML;
}
