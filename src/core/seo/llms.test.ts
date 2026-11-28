import { describe, expect, it } from 'vitest';
import { buildLlmsTxt, processingFact } from './llms';

const base = {
  siteName: 'SynTools',
  summary: 'A free online toolkit that runs entirely in the browser.',
  facts: ['Two URL trees: en and 简体中文', 'AGPL-3.0 source'],
};

describe('processingFact', () => {
  it('纯前端构建仍然声称「全部在浏览器内运行」', () => {
    const fact = processingFact([]);
    expect(fact).toContain('Everything runs in the browser');
    expect(fact).not.toContain('server');
  });

  it('有服务端工具时改成「文件不出本机 + 唯一一次同源调用」，并点名工具', () => {
    const fact = processingFact(['IP Location']);
    expect(fact).toContain('One tool (IP Location)');
    expect(fact).toContain("visitor's own IP geolocation");
    expect(fact).not.toContain('Everything runs in the browser');
    expect(processingFact(['A', 'B'])).toContain('2 tools (A, B)');
  });
});

describe('buildLlmsTxt', () => {
  it('以 H1 + blockquote 摘要 + 事实列表开头', () => {
    const text = buildLlmsTxt({ ...base, sections: [], optional: [] });
    // Blocks are separated by a blank line, per the llms.txt format
    const lines = text.split('\n');
    expect(lines[0]).toBe('# SynTools');
    expect(lines[2]).toBe('> A free online toolkit that runs entirely in the browser.');
    expect(lines[4]).toBe('- Two URL trees: en and 简体中文');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('按调用方给的顺序输出分组，每条链接带一句说明', () => {
    const text = buildLlmsTxt({
      ...base,
      sections: [
        {
          heading: 'PDF',
          links: [
            {
              url: 'https://example.com/tools/pdf-editor/',
              name: 'PDF Editor',
              description: 'Edit a PDF in the browser and save an editable project.',
            },
          ],
        },
      ],
      optional: [],
    });
    expect(text).toContain(
      '## PDF\n\n- [PDF Editor](https://example.com/tools/pdf-editor/): Edit a PDF',
    );
    expect(text).not.toContain('## Optional');
  });

  it('跳过空分组，但保留 Optional 及其顺序', () => {
    const text = buildLlmsTxt({
      ...base,
      sections: [
        { heading: 'Empty', links: [] },
        { heading: 'Text', links: [{ url: 'https://example.com/a/', name: 'A', description: '' }] },
      ],
      optional: [{ url: 'https://example.com/pricing/', name: 'Pricing', description: 'Free' }],
    });
    expect(text).not.toContain('## Empty');
    expect(text).toContain('- [A](https://example.com/a/)');
    expect(text.indexOf('## Optional')).toBeGreaterThan(text.indexOf('## Text'));
  });

  it('把说明里的换行压成一行，避免破坏列表', () => {
    const text = buildLlmsTxt({
      ...base,
      sections: [
        { heading: 'S', links: [{ url: 'u', name: 'N', description: 'line one\nline  two' }] },
      ],
      optional: [],
    });
    expect(text).toContain('- [N](u): line one line two');
    expect(text).not.toContain('line  two');
  });
});
