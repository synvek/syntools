import { describe, expect, it } from 'vitest';
import { tools } from './index';

/**
 * The PDF editor is the "open and edit" entry of the PDF category, so it must stay first.
 *
 * This is the rule both the sidebar and the home page use (`sort((a, b) => weight)`), kept as a test
 * because a single number in a metadata file is far too easy to lose in a merge.
 */
describe('registry ordering', () => {
  it('PDF 编辑器排在 PDF 分类首位', () => {
    const pdfTools = tools
      .filter((tool) => tool.category === 'pdf')
      .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
    expect(pdfTools[0]?.id).toBe('pdf-editor');
  });

  it('工具 id 唯一', () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
