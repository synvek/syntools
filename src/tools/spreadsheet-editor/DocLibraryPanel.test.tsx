import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoredVersion } from './docStore';
import { DocLibraryPanel, StorageNotice, VersionHistoryPanel } from './DocLibraryPanel';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  // 带插值时把参数带上，方便断言 "已用 1.0 KB / 可用 4.0 KB" 这类文案
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

/** P2-3：文档库降级要可见——横幅说清原因并能重试，面板给出占用与"腾地方"的出口 */

const noop = () => {};

describe('StorageNotice', () => {
  it('库正常时什么都不渲染', () => {
    const { container } = render(<StorageNotice status={{ ok: true }} onRetry={noop} />);
    expect(container.innerHTML).toBe('');
  });

  it('库不可用 / 空间不足给不同文案，重试会回调', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <StorageNotice status={{ ok: false, code: 'unavailable' }} onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('tools.sheet.storeUnavailable');

    rerender(<StorageNotice status={{ ok: false, code: 'quota' }} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('tools.sheet.storeQuota');

    fireEvent.click(screen.getByText('tools.sheet.storeRetry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('只有空间不足才提供"删除旧版本"（清版本救不了"根本没有库"）', () => {
    const onFreeSpace = vi.fn();
    const { rerender } = render(
      <StorageNotice
        status={{ ok: false, code: 'unavailable' }}
        onRetry={noop}
        onFreeSpace={onFreeSpace}
      />,
    );
    expect(screen.queryByText('tools.sheet.deleteOldVersions')).toBeNull();

    rerender(
      <StorageNotice
        status={{ ok: false, code: 'quota' }}
        onRetry={noop}
        onFreeSpace={onFreeSpace}
      />,
    );
    fireEvent.click(screen.getByText('tools.sheet.deleteOldVersions'));
    expect(onFreeSpace).toHaveBeenCalledTimes(1);
  });
});

describe('DocLibraryPanel', () => {
  const props = {
    currentDocId: 'a',
    docs: [{ id: 'a', title: 'Book', updatedAt: 0 }],
    onOpen: noop,
    onDuplicate: noop,
    onDelete: noop,
    onNew: noop,
    onClose: noop,
  };

  it('有占用数据时显示已用 / 可用', () => {
    render(<DocLibraryPanel {...props} usage={{ used: 1024, quota: 4 * 1024 * 1024 }} />);
    const line = screen.getByTestId('sheet-storage-usage');
    expect(line.textContent).toContain('tools.sheet.storageUsage');
    expect(line.textContent).toContain('1.0 KB');
    expect(line.textContent).toContain('4.0 MB');
  });

  it('拿不到占用就不显示这一行（而不是显示 0）', () => {
    render(<DocLibraryPanel {...props} usage={null} />);
    expect(screen.queryByTestId('sheet-storage-usage')).toBeNull();
  });
});

describe('VersionHistoryPanel 删除旧版本', () => {
  const versions: StoredVersion[] = [
    { id: 'v2', docId: 'a', title: 'Book', snapshot: {} as never, savedAt: 2 },
    { id: 'v1', docId: 'a', title: 'Book', snapshot: {} as never, savedAt: 1 },
  ];

  it('每行都有删除按钮，顶部有清空入口', () => {
    const onDeleteVersion = vi.fn();
    const onClearVersions = vi.fn();
    render(
      <VersionHistoryPanel
        versions={versions}
        onRestore={noop}
        onClose={noop}
        onDeleteVersion={onDeleteVersion}
        onClearVersions={onClearVersions}
      />,
    );

    const deletes = screen.getAllByLabelText('tools.sheet.deleteVersion');
    expect(deletes).toHaveLength(2);
    fireEvent.click(deletes[0]);
    expect(onDeleteVersion).toHaveBeenCalledWith(versions[0]);

    fireEvent.click(screen.getByText('tools.sheet.clearVersions'));
    expect(onClearVersions).toHaveBeenCalledTimes(1);
  });

  it('没有回调时不显示删除入口（只读用法不受影响）', () => {
    render(<VersionHistoryPanel versions={versions} onRestore={noop} onClose={noop} />);
    expect(screen.queryByLabelText('tools.sheet.deleteVersion')).toBeNull();
    expect(screen.queryByText('tools.sheet.clearVersions')).toBeNull();
  });
});
