import Prism from 'prismjs';
// 依赖顺序：markup → css → clike → javascript → jsx → typescript → tsx → 其余
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
 * 代码编辑器使用的 Prism 语言包集中在此导入（工具 chunk 内，不进首屏）。
 * 组件与导出逻辑共用，避免多处重复 import 造成语言包被重复打包。
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 高亮为 HTML 字符串；`none` 或缺失语法时仅转义。
 *
 * 注意：空文本必须返回空串。历史上这里用 `code || ' '` 为空编辑区「撑」出行高，
 * 但编辑区内容是 CodeJar 的 `textContent`，注入的空格会被当成真实内容——
 * 清空后输入的第一个字符会变成 ` a`，并一路带进预览、统计与导出文件。
 * 行高由 `.ce-surface` 的 padding 与 line-height 保证，无需填充字符。
 */
export function highlightCode(code: string, prismKey: string): string {
  const grammar = prismKey === 'none' ? undefined : Prism.languages[prismKey];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, prismKey);
}

export { Prism };
