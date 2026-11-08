import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DocLibraryPanel, VersionHistoryPanel } from './DocLibraryPanel';
import type { DocMeta, StoredVersion } from './docStore';

/** 文档库 / 版本面板：列表渲染、空态、以及每个按钮是否把正确的 id 传给回调 */

const docs: DocMeta[] = [
  { id: 'doc-a', title: '季度报告', updatedAt: 1_700_000_000_000 },
  { id: 'doc-b', title: '', updatedAt: 1_700_000_100_000 },
];

function renderLibrary(overrides: Partial<Parameters<typeof DocLibraryPanel>[0]> = {}) {
  const callbacks = {
    onOpen: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    onClose: vi.fn(),
  };
  render(<DocLibraryPanel currentDocId="doc-a" docs={docs} {...callbacks} {...overrides} />);
  return callbacks;
}

describe('DocLibraryPanel', () => {
  it('renders every document and falls back to the untitled label for an empty title', () => {
    renderLibrary();
    const panel = screen.getByTestId('rich-text-library');
    expect(within(panel).getByText('季度报告')).toBeTruthy();
    expect(within(panel).getByText('tools.richText.untitledDoc')).toBeTruthy();
  });

  it('shows the empty state instead of a list when there are no documents', () => {
    renderLibrary({ docs: [] });
    const panel = screen.getByTestId('rich-text-library');
    expect(within(panel).getByText('tools.richText.libraryEmpty')).toBeTruthy();
    expect(within(panel).queryByRole('list')).toBeNull();
  });

  it('passes the clicked document id to open / duplicate / delete', () => {
    const callbacks = renderLibrary();
    const row = screen.getByText('季度报告').closest('li') as HTMLElement;

    fireEvent.click(screen.getByText('季度报告'));
    expect(callbacks.onOpen).toHaveBeenCalledWith('doc-a');

    fireEvent.click(within(row).getByLabelText('tools.richText.duplicateDoc'));
    expect(callbacks.onDuplicate).toHaveBeenCalledWith('doc-a');

    fireEvent.click(within(row).getByLabelText('tools.richText.deleteDoc'));
    expect(callbacks.onDelete).toHaveBeenCalledWith('doc-a');
  });

  it('wires the create and close buttons', () => {
    const callbacks = renderLibrary();
    fireEvent.click(screen.getByText('tools.richText.libraryNew'));
    expect(callbacks.onNew).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('tools.richText.libraryClose'));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });
});

function buildVersion(overrides: Partial<StoredVersion> = {}): StoredVersion {
  return {
    id: 'v-1',
    docId: 'doc-a',
    schemaVersion: 2,
    title: '季度报告',
    html: '<p>正文</p>',
    comments: [],
    changes: [],
    userWords: [],
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function renderVersions(overrides: Partial<Parameters<typeof VersionHistoryPanel>[0]> = {}) {
  const callbacks = {
    onRestore: vi.fn(),
    onCompare: vi.fn(),
    onManualSnapshot: vi.fn(),
    onClose: vi.fn(),
  };
  render(<VersionHistoryPanel versions={[]} canSnapshot {...callbacks} {...overrides} />);
  return callbacks;
}

describe('VersionHistoryPanel', () => {
  it('shows the empty state when a document has no snapshots yet', () => {
    renderVersions();
    expect(screen.getByText('tools.richText.noVersions')).toBeTruthy();
  });

  it('disables the snapshot button until the document has an id', () => {
    renderVersions({ canSnapshot: false });
    const button = screen.getByText('tools.richText.snapshotNow') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('submits the trimmed note and clears the input', () => {
    const callbacks = renderVersions();
    const input = screen.getByPlaceholderText(
      'tools.richText.snapshotNotePlaceholder',
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '  定稿  ' } });
    fireEvent.click(screen.getByText('tools.richText.snapshotNow'));

    expect(callbacks.onManualSnapshot).toHaveBeenCalledWith('定稿');
    expect(input.value).toBe('');
  });

  it('submits on Enter without reloading the field', () => {
    const callbacks = renderVersions();
    const input = screen.getByPlaceholderText('tools.richText.snapshotNotePlaceholder');

    fireEvent.change(input, { target: { value: '发布前' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(callbacks.onManualSnapshot).toHaveBeenCalledWith('发布前');
  });

  it('prefers the note over the title and falls back to the untitled label', () => {
    renderVersions({
      versions: [buildVersion({ id: 'v-1', note: '定稿' }), buildVersion({ id: 'v-2', title: '' })],
    });
    expect(screen.getByText('定稿')).toBeTruthy();
    expect(screen.getByText('tools.richText.untitledDoc')).toBeTruthy();
  });

  it('passes the clicked snapshot to compare / restore', () => {
    const version = buildVersion({ id: 'v-9', note: '版本九' });
    const callbacks = renderVersions({ versions: [version] });
    const row = screen.getByText('版本九').closest('li') as HTMLElement;

    fireEvent.click(within(row).getByLabelText('tools.richText.versionDiffTitle'));
    expect(callbacks.onCompare).toHaveBeenCalledWith(version);

    fireEvent.click(within(row).getByText('tools.richText.restoreVersion'));
    expect(callbacks.onRestore).toHaveBeenCalledWith(version);
  });
});
