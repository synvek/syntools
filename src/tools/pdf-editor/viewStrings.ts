/**
 * View-mode, panel-state, status-bar and canvas-caption copy.
 *
 * Separate block from `ribbonStrings.ts` so adding view options never touches the ribbon table;
 * merged into `tools.pdfEditor.*` by `pdfEditorStrings`.
 */

type StringTree = { [key: string]: string | StringTree };

export const viewStrings: Record<string, StringTree> = {
  zh: {
    statusNoFile: '未打开文件',
    viewSingle: '单页',
    viewContinuous: '连续',
    pageAria: '第 {{page}} 页',
  },
  'zh-TW': {
    statusNoFile: '未開啟檔案',
    viewSingle: '單頁',
    viewContinuous: '連續',
    pageAria: '第 {{page}} 頁',
  },
  en: {
    statusNoFile: 'No file open',
    viewSingle: 'Single page',
    viewContinuous: 'Continuous',
    pageAria: 'Page {{page}}',
  },
  ja: {
    statusNoFile: 'ファイル未選択',
    viewSingle: '単一ページ',
    viewContinuous: '連続',
    pageAria: '{{page}} ページ',
  },
  fr: {
    statusNoFile: 'Aucun fichier ouvert',
    viewSingle: 'Page unique',
    viewContinuous: 'Continu',
    pageAria: 'Page {{page}}',
  },
  de: {
    statusNoFile: 'Keine Datei geöffnet',
    viewSingle: 'Einzelne Seite',
    viewContinuous: 'Fortlaufend',
    pageAria: 'Seite {{page}}',
  },
  it: {
    statusNoFile: 'Nessun file aperto',
    viewSingle: 'Pagina singola',
    viewContinuous: 'Continuo',
    pageAria: 'Pagina {{page}}',
  },
  es: {
    statusNoFile: 'Ningún archivo abierto',
    viewSingle: 'Página única',
    viewContinuous: 'Continuo',
    pageAria: 'Página {{page}}',
  },
  pt: {
    statusNoFile: 'Nenhum arquivo aberto',
    viewSingle: 'Página única',
    viewContinuous: 'Contínuo',
    pageAria: 'Página {{page}}',
  },
};
