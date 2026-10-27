import Prism from 'prismjs';
// Dependency order: markup → css → clike → javascript → jsx → typescript → tsx → the rest
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-dart';

/**
 * Prism grammars used by the code editor are imported here in one place (inside the tool chunk,
 * never the initial bundle). Shared by the component and the export logic so no grammar is bundled twice.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Highlight to an HTML string; `none` or a missing grammar only escapes.
 *
 * Note: empty text must return an empty string. This used to return `code || ' '` to "prop up"
 * the line height of an empty editor, but since the content is CodeJar's `textContent` the
 * injected space counted as real content: the first character typed after clearing became ` a`
 * and leaked into the preview, the stats and the exported file. Line height comes from
 * `.ce-surface` padding plus line-height, so no filler character is needed.
 */
export function highlightCode(code: string, prismKey: string): string {
  const grammar = prismKey === 'none' ? undefined : Prism.languages[prismKey];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, prismKey);
}

export { Prism };
