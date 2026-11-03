import type { Editor } from '@tiptap/react';

/**
 * Word's style gallery presets.
 *
 * Kept as data so the ribbon gallery and any future surface paint the same list: one entry = one
 * composed command (paragraph kind + the marks that go with it), never a structural change.
 */
export type StyleId =
  | 'body'
  | 'title'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'quote'
  | 'code';

export interface StylePreset {
  id: StyleId;
  /** i18n key — resolved by the surface that renders the gallery */
  label: string;
  /** Preview classes: each card shows the style in its own size / weight, like Word's gallery */
  preview: string;
}

/** Nine entries fill a 3 × 3 gallery, so the last row never ends with a hole */
export const STYLE_PRESETS: StylePreset[] = [
  { id: 'body', label: 'tools.richText.styleBody', preview: 'text-sm' },
  { id: 'title', label: 'tools.richText.styleTitle', preview: 'text-lg font-bold' },
  { id: 'heading2', label: 'tools.richText.styleHeading2', preview: 'text-base font-semibold' },
  { id: 'heading3', label: 'tools.richText.styleHeading3', preview: 'text-sm font-semibold' },
  {
    id: 'heading4',
    label: 'tools.richText.styleHeading4',
    preview: 'text-[13px] font-semibold',
  },
  {
    id: 'heading5',
    label: 'tools.richText.styleHeading5',
    preview: 'text-xs font-semibold',
  },
  {
    id: 'heading6',
    label: 'tools.richText.styleHeading6',
    preview: 'text-[11px] font-semibold',
  },
  { id: 'quote', label: 'tools.richText.styleQuote', preview: 'text-sm italic text-gray-500' },
  { id: 'code', label: 'tools.richText.styleCode', preview: 'font-mono text-xs' },
];

/** Applies one preset to the current selection (or the paragraph holding the caret) */
export function applyStylePreset(editor: Editor, id: StyleId): void {
  const chain = editor.chain().focus();
  switch (id) {
    case 'body':
      chain.setParagraph().unsetAllMarks().run();
      break;
    case 'title':
      chain.setNode('heading', { level: 1 }).run();
      break;
    case 'heading2':
      chain.setNode('heading', { level: 2 }).run();
      break;
    case 'heading3':
      chain.setNode('heading', { level: 3 }).run();
      break;
    case 'heading4':
      chain.setNode('heading', { level: 4 }).run();
      break;
    case 'heading5':
      chain.setNode('heading', { level: 5 }).run();
      break;
    case 'heading6':
      chain.setNode('heading', { level: 6 }).run();
      break;
    case 'quote':
      chain.toggleBlockquote().run();
      break;
    case 'code':
      chain.toggleCodeBlock().run();
      break;
  }
}
