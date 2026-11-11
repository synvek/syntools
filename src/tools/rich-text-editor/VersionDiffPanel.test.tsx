import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Keys instead of copy: the assertions below are about which text *slot* got filled, not the wording
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { VersionDiffPanel } from './VersionDiffPanel';
import type { StoredVersion } from './docStore';

/** 版本对比面板：结构化行（块类型变化、词级高亮）必须真的渲染出来 */

function version(html: string): StoredVersion {
  return {
    id: 'v1',
    docId: 'doc-1',
    savedAt: 0,
    schemaVersion: 3,
    title: '历史版本',
    html,
    comments: [],
    changes: [],
  };
}

function renderPanel(before: string, after: string): HTMLElement {
  render(
    <VersionDiffPanel
      versions={[version(before)]}
      currentHtml={after}
      currentTitle="当前文档"
      onRestore={() => {}}
      onClose={() => {}}
    />,
  );
  return screen.getByTestId('rich-text-version-diff-body');
}

describe('VersionDiffPanel', () => {
  it('renders a block-kind change as a format row carrying both kinds', () => {
    const body = renderPanel('<h2>标题</h2>', '<p>标题</p>');
    const row = body.querySelector('[data-diff-kind="format"]');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('h2 → p');
    expect(row?.textContent).toContain('标题');
  });

  it('highlights only the words that changed inside a rewritten block', () => {
    const body = renderPanel('<p>hello world</p>', '<p>hello there</p>');
    const texts = (selector: string) =>
      Array.from(body.querySelectorAll(selector)).map((node) => node.textContent);
    expect(texts('[data-seg="delete"]')).toEqual(['world']);
    expect(texts('[data-seg="insert"]')).toEqual(['there']);
  });

  it('counts blocks (not text lines) in the summary', () => {
    renderPanel('<p>甲</p>', '<p>甲</p><p>乙</p><p>丙</p>');
    expect(screen.getByTestId('rich-text-version-diff').textContent).toContain(
      '+2 tools.richText.diffBlocksUnit',
    );
  });

  it('says so when the two sides are identical', () => {
    renderPanel('<p>甲</p>', '<p>甲</p>');
    expect(screen.getByTestId('rich-text-version-diff').textContent).toContain(
      'tools.richText.diffIdentical',
    );
  });
});
