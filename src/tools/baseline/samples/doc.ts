import { DEFAULT_PAGE_SETUP, type PageSetupConfig } from '../../rich-text-editor/pageSetup';

export interface DocSample {
  id: string;
  title: string;
  /** Recorded in the report so a reviewer knows the number is expected, not a bug */
  notes?: string;
  html: () => string;
  setup?: () => PageSetupConfig;
}

export const docSamples: DocSample[] = [
  {
    id: 'docx/basic',
    title: '段落 + 行内样式',
    notes: '导出 XML 含 w:u / w:strike，导入侧 mammoth 只保留 strike、丢掉下划线',
    html: () =>
      [
        '<p>Plain paragraph.</p>',
        '<p><strong>Bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>',
        '<p>Mixed <strong>bold and <em>nested italic</em></strong> run.</p>',
      ].join(''),
  },
  {
    id: 'docx/headings',
    title: '三级标题结构',
    html: () =>
      [
        '<h1>Chapter one</h1>',
        '<p>Intro text.</p>',
        '<h2>Section 1.1</h2>',
        '<p>Body.</p>',
        '<h3>Sub section</h3>',
        '<p>Detail.</p>',
        '<h2>Section 1.2</h2>',
        '<p>More body.</p>',
      ].join(''),
  },
  {
    id: 'docx/lists',
    title: '无序/有序嵌套列表',
    html: () =>
      [
        '<ul><li>Alpha</li><li>Beta<ul><li>Beta.1</li><li>Beta.2</li></ul></li><li>Gamma</li></ul>',
        '<ol><li>First</li><li>Second<ol><li>Second.1</li></ol></li></ol>',
      ].join(''),
  },
  {
    id: 'docx/table',
    title: '表格：表头 + 合并单元格 + 底色',
    html: () =>
      [
        '<table><tbody>',
        '<tr><th colspan="2">Merged header</th><th>Right</th></tr>',
        '<tr><td style="background-color:#FFF2CC">A1</td><td>B1</td><td>C1</td></tr>',
        '<tr><td>A2</td><td colspan="2">Merged body</td></tr>',
        '</tbody></table>',
      ].join(''),
  },
  {
    id: 'docx/header-footer',
    title: '页眉 / 页脚 / 页码 / 首页不同',
    html: () => '<h1>Report</h1><p>Body paragraph.</p><p>Second paragraph.</p>',
    setup: () => ({
      ...DEFAULT_PAGE_SETUP,
      header: '基线页眉',
      footer: '基线页脚',
      showPageNumber: true,
      differentFirstPage: true,
    }),
  },
  {
    id: 'docx/quote-code-link',
    title: '引用 / 代码块 / 链接',
    notes: '导出写 Quote / Code 命名样式，导入经 mammoth styleMap 还原 blockquote / pre',
    html: () =>
      [
        '<blockquote><p>Quoted text.</p></blockquote>',
        '<pre><code>const x = 1;</code></pre>',
        '<p><a href="https://example.com">Example link</a></p>',
      ].join(''),
  },
  {
    id: 'docx/landscape-letter',
    title: 'Letter 横向 + 窄边距 + 分栏',
    html: () => '<h1>Landscape</h1><p>Column one content.</p><p>Column two content.</p>',
    setup: () => ({
      ...DEFAULT_PAGE_SETUP,
      size: 'Letter',
      orientation: 'landscape',
      margin: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
      columns: 2,
    }),
  },
];
