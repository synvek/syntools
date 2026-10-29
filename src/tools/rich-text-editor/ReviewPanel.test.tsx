import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ReviewPanel } from './ReviewPanel';
import type { TrackedChange } from './docs';

/** P2-3.3/P2-3.4：逐条接受/拒绝按钮必须带上下文，且只动被点的那一条 */

const changes: TrackedChange[] = [
  { id: 'cmp-1', kind: 'delete', text: '旧的一段话', author: '甲', createdAt: 1 },
  { id: 'cmp-2', kind: 'insert', text: '新加的一段话', author: '乙', createdAt: 2 },
];

function renderPanel(overrides: Partial<Parameters<typeof ReviewPanel>[0]> = {}) {
  const callbacks = {
    onAcceptChange: vi.fn(),
    onRejectChange: vi.fn(),
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
    onFocusChange: vi.fn(),
  };
  render(
    <ReviewPanel
      comments={[]}
      changes={changes}
      pendingQuote={null}
      author="甲"
      onAuthorChange={() => {}}
      onSubmitComment={() => {}}
      onCancelComment={() => {}}
      onAddComment={() => {}}
      onRemoveComment={() => {}}
      onToggleResolved={() => {}}
      onReplyComment={() => {}}
      onClose={() => {}}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

describe('ReviewPanel per-change actions', () => {
  it('labels every per-change button with the change text so they stay distinguishable', () => {
    renderPanel();
    // 2 changes × 2 buttons; the text prefix tells screen readers which revision they act on
    expect(
      screen.getByRole('button', { name: 'tools.richText.acceptOne 旧的一段话' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'tools.richText.rejectOne 新加的一段话' }),
    ).toBeInTheDocument();
  });

  it('accepts only the clicked change', () => {
    const { onAcceptChange, onRejectChange, onAcceptAll } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.acceptOne 旧的一段话' }));
    expect(onAcceptChange).toHaveBeenCalledWith('cmp-1');
    expect(onAcceptChange).toHaveBeenCalledTimes(1);
    expect(onRejectChange).not.toHaveBeenCalled();
    expect(onAcceptAll).not.toHaveBeenCalled();
  });

  it('rejects only the clicked change', () => {
    const { onRejectChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.rejectOne 新加的一段话' }));
    expect(onRejectChange).toHaveBeenCalledWith('cmp-2');
    expect(onRejectChange).toHaveBeenCalledTimes(1);
  });

  it('shows a format revision with its own marker instead of the insert sign', () => {
    renderPanel({
      changes: [{ id: 'cmp-9', kind: 'format', text: '标题', author: '', createdAt: 3 }],
    });
    expect(screen.getByText('±')).toBeInTheDocument();
  });
});

describe('ReviewPanel navigation and filtering', () => {
  it('walks revisions with prev/next and reports the position', () => {
    const { onFocusChange } = renderPanel();
    expect(screen.getByTestId('rich-text-change-position')).toHaveTextContent('1/2');
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.nextChange' }));
    // Cursor moved to the second entry, and the editor was asked to select it
    expect(onFocusChange).toHaveBeenLastCalledWith('cmp-2');
    expect(screen.getByTestId('rich-text-change-position')).toHaveTextContent('2/2');
    // Wraps around instead of dead-ending at the last entry
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.nextChange' }));
    expect(onFocusChange).toHaveBeenLastCalledWith('cmp-1');
  });

  it('jumps to a revision when its row is clicked', () => {
    const { onFocusChange } = renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: 'tools.richText.focusChange 新加的一段话' }),
    );
    expect(onFocusChange).toHaveBeenCalledWith('cmp-2');
  });

  it('filters revisions by author and resets the cursor', () => {
    renderPanel();
    const filter = screen.getByRole('combobox', { name: 'tools.richText.authorFilter' });
    fireEvent.change(filter, { target: { value: '乙' } });
    expect(
      screen.getByRole('button', { name: 'tools.richText.acceptOne 新加的一段话' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'tools.richText.acceptOne 旧的一段话' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('rich-text-change-position')).toHaveTextContent('1/1');
    // Back to "all authors": both revisions come back
    fireEvent.change(filter, { target: { value: '' } });
    expect(screen.getByTestId('rich-text-change-position')).toHaveTextContent('1/2');
  });

  it('hides the author filter when every revision has the same author', () => {
    renderPanel({
      changes: [{ id: 'cmp-1', kind: 'delete', text: '只有一位作者', author: '甲', createdAt: 1 }],
    });
    expect(
      screen.queryByRole('combobox', { name: 'tools.richText.authorFilter' }),
    ).not.toBeInTheDocument();
  });

  it('flags an orphaned comment instead of hiding it', () => {
    renderPanel({
      comments: [
        {
          id: 'c-1',
          quote: '被删掉的文字',
          text: '这段要改',
          author: '甲',
          createdAt: 1,
          resolved: false,
          orphaned: true,
        },
      ],
    });
    expect(screen.getByTestId('rich-text-comment-orphaned')).toHaveTextContent(
      'tools.richText.commentAnchorLost',
    );
    expect(screen.getByText('这段要改')).toBeInTheDocument();
  });
});
