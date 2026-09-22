import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { useFlowStore } from '../store';
import {
  DEFAULT_RASTER_OPTIONS,
  EXPORT_KINDS,
  exportRaster,
  exportText,
  parseDrawioXml,
  parseProjectJson,
  type ExportKind,
  type RasterExportOptions,
  type RasterFormat,
} from '../io';

const TEXT_KINDS: ExportKind[] = ['project', 'drawio', 'mermaid'];

interface IoMenuProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (message: string | null) => void;
}

export function IoMenu({ busy, setBusy, onError }: IoMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RasterExportOptions>(DEFAULT_RASTER_OPTIONS);
  const [onlySelected, setOnlySelected] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runExport = async (kind: ExportKind) => {
    setOpen(false);
    onError(null);
    const state = useFlowStore.getState();
    // 导出文件名取自工具栏的文档标题
    const filename = state.docName.trim() || 'flowchart';

    if (TEXT_KINDS.includes(kind)) {
      const ok = exportText(state.getDoc(), kind, filename);
      if (!ok) onError(t('tools.flowchart.err.EXPORT_FAILED'));
      return;
    }

    setBusy(true);
    const nodes = onlySelected
      ? state.nodes.filter((n) => state.selectedNodes.includes(n.id))
      : state.nodes;
    const result = await exportRaster(
      nodes,
      { ...options, format: kind as RasterFormat },
      filename,
    );
    setBusy(false);
    if (!result.ok) {
      onError(
        result.error === 'EMPTY'
          ? t('tools.flowchart.err.EMPTY')
          : t('tools.flowchart.err.EXPORT_FAILED'),
      );
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onError(null);
    const text = await file.text();
    const doc = file.name.toLowerCase().endsWith('.json')
      ? parseProjectJson(text)
      : parseDrawioXml(text);
    if (!doc) {
      onError(t('tools.flowchart.err.IMPORT_FAILED'));
      return;
    }
    useFlowStore.getState().load(doc);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" />
          {t('tools.flowchart.exportPanel')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="upload" className="h-4 w-4" />
          {t('tools.flowchart.importFile')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.xml,.drawio"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {open ? (
        <div className="absolute right-0 top-9 z-30 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="px-1 pb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {t('tools.flowchart.exportPanel')}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {EXPORT_KINDS.map((meta) => (
              <button
                key={meta.kind}
                type="button"
                onClick={() => void runExport(meta.kind)}
                className="rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-500/10"
              >
                {meta.ext}
              </button>
            ))}
          </div>

          <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
            <label className="flex items-center justify-between px-1 py-1 text-[12px] text-gray-600 dark:text-gray-300">
              <span>{t('tools.flowchart.scale')}</span>
              <select
                value={options.scale}
                onChange={(e) => setOptions({ ...options, scale: Number(e.target.value) })}
                className="h-7 rounded-md border border-gray-200 bg-white px-1 text-[12px] dark:border-gray-700 dark:bg-gray-800"
              >
                {[1, 2, 3].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 px-1 py-1 text-[12px] text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={options.transparent}
                onChange={(e) => setOptions({ ...options, transparent: e.target.checked })}
              />
              {t('tools.flowchart.transparentBg')}
            </label>
            <label className="flex items-center gap-2 px-1 py-1 text-[12px] text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={onlySelected}
                onChange={(e) => setOnlySelected(e.target.checked)}
              />
              {t('tools.flowchart.onlySelected')}
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
