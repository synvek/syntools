import { Mark, mergeAttributes } from '@tiptap/core';

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
        // Footnote references are their own node (sup[data-footnote]); parsing them as a
        // superscript mark would swallow the node and lose the note body.
        getAttrs: (el) => (el.hasAttribute('data-footnote') ? false : null),
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

/** Marks registered by the rich-text extension set (order matters only for serialization clarity) */
export const charFormatExtensions = [Superscript, Subscript, LetterSpacing, TextTransform];
