/**
 * Copy for the file / print commands (implementation plan P0-3).
 *
 * Same incremental-block pattern as `ribbonStrings` / `charFormatStrings`: merged into
 * `tools.richText.*` by `richTextStrings`, so the nine main language blocks stay untouched.
 * `strings.test.ts` verifies that every language has exactly the same key set.
 */

type StringTree = { [key: string]: string | StringTree };

export const fileStrings: Record<string, StringTree> = {
  zh: {
    print: '打印',
    printPreview: '打印预览',
    printPreviewHint: '与导出页面使用同一份排版，确认无误后再打印。',
    printPreviewClose: '关闭',
    exportTxt: '导出纯文本 (.txt)',
    importText: '导入文本 (.txt / .md / .html)',
    savedNotice: '已保存到本机',
  },
  en: {
    print: 'Print',
    printPreview: 'Print preview',
    printPreviewHint: 'Uses the same layout as the exported page. Review it before printing.',
    printPreviewClose: 'Close',
    exportTxt: 'Export plain text (.txt)',
    importText: 'Import text (.txt / .md / .html)',
    savedNotice: 'Saved on this device',
  },
  'zh-TW': {
    print: '列印',
    printPreview: '列印預覽',
    printPreviewHint: '與匯出頁面使用相同版面，確認後再列印。',
    printPreviewClose: '關閉',
    exportTxt: '匯出純文字 (.txt)',
    importText: '匯入文字 (.txt / .md / .html)',
    savedNotice: '已儲存至本機',
  },
  ja: {
    print: '印刷',
    printPreview: '印刷プレビュー',
    printPreviewHint: '書き出しページと同じレイアウトです。確認してから印刷してください。',
    printPreviewClose: '閉じる',
    exportTxt: 'プレーンテキストを書き出す (.txt)',
    importText: 'テキストを読み込む (.txt / .md / .html)',
    savedNotice: 'この端末に保存しました',
  },
  fr: {
    print: 'Imprimer',
    printPreview: 'Aperçu avant impression',
    printPreviewHint:
      "Utilise la même mise en page que la page exportée. Vérifiez avant d'imprimer.",
    printPreviewClose: 'Fermer',
    exportTxt: 'Exporter en texte brut (.txt)',
    importText: 'Importer du texte (.txt / .md / .html)',
    savedNotice: 'Enregistré sur cet appareil',
  },
  de: {
    print: 'Drucken',
    printPreview: 'Druckvorschau',
    printPreviewHint:
      'Verwendet dasselbe Layout wie die exportierte Seite. Bitte vor dem Drucken prüfen.',
    printPreviewClose: 'Schließen',
    exportTxt: 'Klartext exportieren (.txt)',
    importText: 'Text importieren (.txt / .md / .html)',
    savedNotice: 'Auf diesem Gerät gespeichert',
  },
  it: {
    print: 'Stampa',
    printPreview: 'Anteprima di stampa',
    printPreviewHint: 'Usa lo stesso layout della pagina esportata. Controlla prima di stampare.',
    printPreviewClose: 'Chiudi',
    exportTxt: 'Esporta testo semplice (.txt)',
    importText: 'Importa testo (.txt / .md / .html)',
    savedNotice: 'Salvato su questo dispositivo',
  },
  es: {
    print: 'Imprimir',
    printPreview: 'Vista previa de impresión',
    printPreviewHint: 'Usa el mismo diseño que la página exportada. Revísalo antes de imprimir.',
    printPreviewClose: 'Cerrar',
    exportTxt: 'Exportar texto plano (.txt)',
    importText: 'Importar texto (.txt / .md / .html)',
    savedNotice: 'Guardado en este dispositivo',
  },
  pt: {
    print: 'Imprimir',
    printPreview: 'Pré-visualização de impressão',
    printPreviewHint: 'Usa o mesmo layout da página exportada. Confira antes de imprimir.',
    printPreviewClose: 'Fechar',
    exportTxt: 'Exportar texto simples (.txt)',
    importText: 'Importar texto (.txt / .md / .html)',
    savedNotice: 'Guardado neste dispositivo',
  },
};
