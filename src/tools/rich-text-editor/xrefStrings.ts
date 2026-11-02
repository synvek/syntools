/**
 * 交叉引用（RTE-03 第二批）文案。
 *
 * 与 `bookmarkStrings.ts` / `charFormatStrings.ts` 一样单独成块，由 `strings.ts` 的
 * `EXTRA_STRINGS` 合并进 `tools.richText.*`。
 */
export const xrefStrings: Record<string, Record<string, string>> = {
  zh: {
    xref: '交叉引用',
    xrefTarget: '引用目标',
    xrefMode: '引用类型',
    xrefModeText: '引用文字',
    xrefModePage: '引用页码',
    xrefInsert: '插入引用',
    xrefNoBookmarks: '请先插入书签，再建立交叉引用',
    xrefExisting: '文档中的交叉引用',
    xrefMismatch: '该引用指向的书签已不存在',
    xrefTextHint: '文字模式引用书签所在段落的文字；页码模式随分页实时更新',
    xrefDelete: '删除',
    xrefMissing: '引用失效',
    xrefClose: '关闭',
    lossXrefStatic:
      '{{count}} 处「引用文字」以静态文本导出：Word 中可点击跳转，但不会随书签内容自动更新（「引用页码」是域，可更新）',
  },
  en: {
    xref: 'Cross-reference',
    xrefTarget: 'Reference to',
    xrefMode: 'Type',
    xrefModeText: 'Reference text',
    xrefModePage: 'Reference page',
    xrefInsert: 'Insert reference',
    xrefNoBookmarks: 'Insert a bookmark first, then add a cross-reference',
    xrefExisting: 'Cross-references in this document',
    xrefMismatch: 'The bookmark behind this reference no longer exists',
    xrefTextHint:
      'Text mode references the paragraph the bookmark sits in; page mode follows pagination live',
    xrefDelete: 'Delete',
    xrefMissing: 'Broken reference',
    xrefClose: 'Close',
    lossXrefStatic:
      '{{count}} text reference(s) exported as static text: clickable in Word, but they do not update with the bookmark ("Reference page" is a field and does update)',
  },
  'zh-TW': {
    xref: '交互參照',
    xrefTarget: '參照目標',
    xrefMode: '參照類型',
    xrefModeText: '參照文字',
    xrefModePage: '參照頁碼',
    xrefInsert: '插入參照',
    xrefNoBookmarks: '請先插入書籤，再建立交互參照',
    xrefExisting: '文件中的交互參照',
    xrefMismatch: '此參照指向的書籤已不存在',
    xrefTextHint: '文字模式參照書籤所在段落的文字；頁碼模式隨分頁即時更新',
    xrefDelete: '刪除',
    xrefMissing: '參照失效',
    xrefClose: '關閉',
    lossXrefStatic:
      '{{count}} 處「參照文字」以靜態文字匯出：Word 中可點擊跳轉，但不會隨書籤內容自動更新（「參照頁碼」是欄位，可更新）',
  },
  ja: {
    xref: '相互参照',
    xrefTarget: '参照先',
    xrefMode: '種類',
    xrefModeText: '参照文字',
    xrefModePage: '参照ページ',
    xrefInsert: '参照を挿入',
    xrefNoBookmarks: '先にブックマークを挿入してください',
    xrefExisting: 'この文書の相互参照',
    xrefMismatch: 'この参照先のブックマークは存在しません',
    xrefTextHint:
      '文字モードはブックマークがある段落の文字を参照します。ページモードは改ページに追従します',
    xrefDelete: '削除',
    xrefMissing: '参照が無効',
    xrefClose: '閉じる',
    lossXrefStatic:
      '{{count}} 件の「参照文字」は静的テキストとして書き出されます。Word でクリック移動はできますが、ブックマークの内容に追従しません（「参照ページ」はフィールドなので更新されます）',
  },
  fr: {
    xref: 'Renvoi',
    xrefTarget: 'Renvoi à',
    xrefMode: 'Type',
    xrefModeText: 'Texte du renvoi',
    xrefModePage: 'Page du renvoi',
    xrefInsert: 'Insérer un renvoi',
    xrefNoBookmarks: 'Insérez d’abord un signet, puis créez un renvoi',
    xrefExisting: 'Renvois du document',
    xrefMismatch: 'Le signet ciblé par ce renvoi n’existe plus',
    xrefTextHint:
      'Le mode texte renvoie au paragraphe du signet ; le mode page suit la pagination en direct',
    xrefDelete: 'Supprimer',
    xrefMissing: 'Renvoi rompu',
    xrefClose: 'Fermer',
    lossXrefStatic:
      '{{count}} renvoi(s) de texte exporté(s) en texte statique : cliquables dans Word, mais sans mise à jour avec le signet (« Page du renvoi » est un champ et se met à jour)',
  },
  de: {
    xref: 'Querverweis',
    xrefTarget: 'Verweis auf',
    xrefMode: 'Typ',
    xrefModeText: 'Verweistext',
    xrefModePage: 'Verweisseite',
    xrefInsert: 'Verweis einfügen',
    xrefNoBookmarks: 'Zuerst eine Textmarke einfügen, dann den Querverweis anlegen',
    xrefExisting: 'Querverweise im Dokument',
    xrefMismatch: 'Die Textmarke dieses Verweises existiert nicht mehr',
    xrefTextHint:
      'Textmodus verweist auf den Absatz der Textmarke; Seitenmodus folgt dem Seitenumbruch live',
    xrefDelete: 'Löschen',
    xrefMissing: 'Verweis defekt',
    xrefClose: 'Schließen',
    lossXrefStatic:
      '{{count}} Textverweis(e) als statischer Text exportiert: in Word anklickbar, aber ohne Aktualisierung mit der Textmarke („Verweisseite“ ist ein Feld und aktualisiert sich)',
  },
  it: {
    xref: 'Riferimento incrociato',
    xrefTarget: 'Riferimento a',
    xrefMode: 'Tipo',
    xrefModeText: 'Testo del riferimento',
    xrefModePage: 'Pagina del riferimento',
    xrefInsert: 'Inserisci riferimento',
    xrefNoBookmarks: 'Inserisci prima un segnalibro, poi crea il riferimento',
    xrefExisting: 'Riferimenti incrociati nel documento',
    xrefMismatch: 'Il segnalibro di questo riferimento non esiste più',
    xrefTextHint:
      'La modalità testo rimanda al paragrafo del segnalibro; la modalità pagina segue l’impaginazione',
    xrefDelete: 'Elimina',
    xrefMissing: 'Riferimento non valido',
    xrefClose: 'Chiudi',
    lossXrefStatic:
      '{{count}} riferimento/i di testo esportati come testo statico: cliccabili in Word, ma non si aggiornano con il segnalibro («Pagina del riferimento» è un campo e si aggiorna)',
  },
  es: {
    xref: 'Referencia cruzada',
    xrefTarget: 'Referencia a',
    xrefMode: 'Tipo',
    xrefModeText: 'Texto de la referencia',
    xrefModePage: 'Página de la referencia',
    xrefInsert: 'Insertar referencia',
    xrefNoBookmarks: 'Primero inserta un marcador y luego crea la referencia',
    xrefExisting: 'Referencias cruzadas del documento',
    xrefMismatch: 'El marcador de esta referencia ya no existe',
    xrefTextHint:
      'El modo texto referencia el párrafo del marcador; el modo página sigue la paginación en vivo',
    xrefDelete: 'Eliminar',
    xrefMissing: 'Referencia no válida',
    xrefClose: 'Cerrar',
    lossXrefStatic:
      '{{count}} referencia(s) de texto exportadas como texto estático: se pueden pulsar en Word, pero no se actualizan con el marcador («Página de la referencia» es un campo y sí se actualiza)',
  },
  pt: {
    xref: 'Referência cruzada',
    xrefTarget: 'Referência a',
    xrefMode: 'Tipo',
    xrefModeText: 'Texto da referência',
    xrefModePage: 'Página da referência',
    xrefInsert: 'Inserir referência',
    xrefNoBookmarks: 'Insira um marcador primeiro e depois crie a referência',
    xrefExisting: 'Referências cruzadas no documento',
    xrefMismatch: 'O marcador desta referência não existe mais',
    xrefTextHint:
      'O modo texto referencia o parágrafo do marcador; o modo página acompanha a paginação em tempo real',
    xrefDelete: 'Excluir',
    xrefMissing: 'Referência inválida',
    xrefClose: 'Fechar',
    lossXrefStatic:
      '{{count}} referência(s) de texto exportada(s) como texto estático: clicáveis no Word, mas sem atualização com o marcador («Página da referência» é um campo e é atualizado)',
  },
};
