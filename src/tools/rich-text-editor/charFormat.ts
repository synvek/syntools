import { Mark, mergeAttributes } from '@tiptap/core';
import { isNoteReferenceElement } from './notes';

/**
 * Character-level formatting that Word users expect but ProseMirror's default schema lacks:
 * - superscript / subscript (mutually exclusive, <sup>/<sub>, docx `w:vertAlign`)
 * - letter spacing (inline `letter-spacing`, docx `w:spacing`)
 * - text transform (inline `text-transform`; uppercase maps to docx `w:caps`,
 *   lowercase/capitalize are converted into the text content on export)
 *
 * Everything is a Mark rather than a TextStyle attribute so the value survives HTML
 * round-trips (document save/load and docx export both read the rendered DOM).
 */

export const LETTER_SPACING_PRESETS = [0, 0.5, 1, 1.5, 2] as const;

export type TextTransformValue = 'uppercase' | 'lowercase' | 'capitalize';

export const TEXT_TRANSFORM_VALUES: TextTransformValue[] = ['uppercase', 'lowercase', 'capitalize'];

/** Visual samples used as dropdown labels: language-neutral, no i18n needed */
export const TEXT_TRANSFORM_SAMPLES: Record<TextTransformValue, string> = {
  uppercase: 'ABC',
  lowercase: 'abc',
  capitalize: 'Abc',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    charFormat: {
      /** Toggle superscript on the selection (clears subscript) */
      toggleSuperscript: () => ReturnType;
      /** Toggle subscript on the selection (clears superscript) */
      toggleSubscript: () => ReturnType;
      /** Set letter spacing in px; null / 0 removes it */
      setLetterSpacing: (px: number | null) => ReturnType;
      /** Set text-transform; null removes it */
      setTextTransform: (transform: TextTransformValue | null) => ReturnType;
      /** Toggle small caps (docx `w:smallCaps`) */
      toggleSmallCaps: () => ReturnType;
    };
  }
}

export const Superscript = Mark.create({
  name: 'superscript',
  // Word treats superscript and subscript as one exclusive property
  excludes: 'subscript',
  parseHTML() {
    return [
      {
        tag: 'sup',
        // Footnote / endnote references are their own nodes (sup[data-footnote], sup[data-endnote]);
        // parsing them as a superscript mark would swallow the node and lose the note body.
        getAttrs: (el) => (isNoteReferenceElement(el) ? false : null),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'rte-superscript' }), 0];
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-=': () => this.editor.commands.toggleSuperscript() };
  },
  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes, { class: 'rte-subscript' }), 0];
  },
  addKeyboardShortcuts() {
    return { 'Mod-=': () => this.editor.commands.toggleSubscript() };
  },
  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const LetterSpacing = Mark.create<{ px: number | null }>({
  name: 'letterSpacing',
  addAttributes() {
    return {
      px: {
        default: null,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).style.letterSpacing;
          const value = Number.parseFloat(raw);
          return Number.isFinite(value) ? value : null;
        },
        renderHTML: (attrs) =>
          typeof attrs.px === 'number' && attrs.px !== 0
            ? { style: `letter-spacing: ${attrs.px}px` }
            : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[style*="letter-spacing"]',
        // The selector is loose (any span with a style attribute containing the word);
        // only accept nodes that actually carry a usable value.
        getAttrs: (el) => ((el as HTMLElement).style.letterSpacing ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'rte-letter-spacing' }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setLetterSpacing:
        (px) =>
        ({ commands }) =>
          typeof px === 'number' && px !== 0
            ? commands.setMark(this.name, { px })
            : commands.unsetMark(this.name),
    };
  },
});

export const TextTransform = Mark.create<{ transform: string | null }>({
  name: 'textTransform',
  addAttributes() {
    return {
      transform: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.textTransform || null,
        renderHTML: (attrs) =>
          attrs.transform ? { style: `text-transform: ${attrs.transform}` } : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[style*="text-transform"]',
        getAttrs: (el) => ((el as HTMLElement).style.textTransform ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'rte-text-transform' }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextTransform:
        (transform) =>
        ({ commands }) =>
          transform ? commands.setMark(this.name, { transform }) : commands.unsetMark(this.name),
    };
  },
});

/**
 * 小型大写（Word 的"小型大写字母"，docx `w:smallCaps`）。
 *
 * 与 TextTransform 分开而不是并进 `text-transform`：CSS 没有 small-caps 的 text-transform 值，
 * 浏览器里靠 `font-variant` 才有等效效果，而两者在 Word 里也是彼此独立的两个开关。
 */
export const SmallCaps = Mark.create({
  name: 'smallCaps',
  parseHTML() {
    return [
      {
        tag: 'span[style*="font-variant"]',
        getAttrs: (el) => ((el as HTMLElement).style.fontVariant ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { class: 'rte-small-caps', style: 'font-variant: small-caps' },
        HTMLAttributes,
      ),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-K': () => this.editor.commands.toggleSmallCaps() };
  },
  addCommands() {
    return {
      toggleSmallCaps:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

/**
 * 着重号 (`w:em`): the dots Chinese typesetting puts *under* emphasised characters. Word has no CSS
 * equivalent in a mark, but `text-emphasis` does exactly this, so the mark only carries the style name
 * and the visual comes from one rule in `editor.css`.
 */
export const EmphasisMark = Mark.create({
  name: 'emphasisMark',
  addAttributes() {
    return {
      emphasize: {
        default: 'dot',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-emphasis') ?? 'dot',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-emphasis': attributes.emphasize ?? 'dot',
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-emphasis]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'rte-emphasis' }, HTMLAttributes), 0];
  },
});

/** Marks registered by the rich-text extension set (order matters only for serialization clarity) */
export const charFormatExtensions = [
  Superscript,
  Subscript,
  LetterSpacing,
  TextTransform,
  SmallCaps,
  EmphasisMark,
];
