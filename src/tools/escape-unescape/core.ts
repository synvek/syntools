export type EscapeKind = 'json' | 'js' | 'html' | 'xml' | 'url';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const HTML_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(HTML_ENTITIES).map(([k, v]) => [v, k]),
);
const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const XML_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(XML_ENTITIES).map(([k, v]) => [v, k]),
);

/** 转义：把字符串编码为对应表示 */
export function escapeText(text: string, kind: EscapeKind): string {
  switch (kind) {
    case 'json':
      return JSON.stringify(text);
    case 'js':
      return JSON.stringify(text).slice(1, -1);
    case 'html': {
      let out = text;
      for (const [ch, ent] of Object.entries(HTML_ENTITIES)) out = out.split(ch).join(ent);
      return out;
    }
    case 'xml': {
      let out = text;
      for (const [ch, ent] of Object.entries(XML_ENTITIES)) out = out.split(ch).join(ent);
      return out;
    }
    case 'url':
      return encodeURIComponent(text);
  }
}

/** 反转义 */
export function unescapeText(text: string, kind: EscapeKind): string {
  switch (kind) {
    case 'json':
      try {
        const parsed = JSON.parse(`"${text}"`);
        return typeof parsed === 'string' ? parsed : text;
      } catch {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    case 'js':
      try {
        return JSON.parse(`"${text}"`);
      } catch {
        return text;
      }
    case 'html':
      return text.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => HTML_REVERSE[m] ?? m);
    case 'xml':
      return text.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_REVERSE[m] ?? m);
    case 'url':
      try {
        return decodeURIComponent(text);
      } catch {
        return text;
      }
  }
}
