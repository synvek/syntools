/**
 * 尾注（RTE-03 收口）文案。
 *
 * 取消/确定复用脚注那两条（`footnoteCancel` / `footnoteSubmit`）：它们就是普通按钮语，
 * 逐语言再抄一遍只会让两处翻译慢慢走偏。
 */
export const endnoteStrings: Record<string, Record<string, string>> = {
  zh: {
    endnote: '尾注',
    endnoteEmpty: '（空尾注）',
    endnoteInsert: '插入尾注',
    endnoteEdit: '编辑尾注',
    endnoteDialogDesc: '尾注显示在文档最末，导出 Word 时写入 Word 尾注部件（与脚注各自编号）',
    endnotePlaceholder: '输入尾注内容，回车确定，Shift+回车换行',
    endnoteRemove: '删除尾注',
  },
  en: {
    endnote: 'Endnote',
    endnoteEmpty: '(empty endnote)',
    endnoteInsert: 'Insert endnote',
    endnoteEdit: 'Edit endnote',
    endnoteDialogDesc:
      'Endnotes appear at the very end of the document and are exported as a Word endnotes part (numbered separately from footnotes)',
    endnotePlaceholder: 'Enter the endnote text. Enter to confirm, Shift+Enter for a new line',
    endnoteRemove: 'Delete endnote',
  },
  'zh-TW': {
    endnote: '章節附註',
    endnoteEmpty: '（空章節附註）',
    endnoteInsert: '插入章節附註',
    endnoteEdit: '編輯章節附註',
    endnoteDialogDesc: '章節附註顯示於文件最末，匯出 Word 時寫入 Word 尾注部件（與腳註各自編號）',
    endnotePlaceholder: '輸入章節附註內容，Enter 確定，Shift+Enter 換行',
    endnoteRemove: '刪除章節附註',
  },
  ja: {
    endnote: '文末脚注',
    endnoteEmpty: '（空の文末脚注）',
    endnoteInsert: '文末脚注を挿入',
    endnoteEdit: '文末脚注を編集',
    endnoteDialogDesc:
      '文末脚注は文書の最後に表示され、Word へは endnotes パーツとして書き出されます（脚注とは別番号）',
    endnotePlaceholder: '文末脚注の内容を入力。Enter で確定、Shift+Enter で改行',
    endnoteRemove: '文末脚注を削除',
  },
  fr: {
    endnote: 'Note de fin',
    endnoteEmpty: '(note de fin vide)',
    endnoteInsert: 'Insérer une note de fin',
    endnoteEdit: 'Modifier la note de fin',
    endnoteDialogDesc:
      'Les notes de fin apparaissent à la fin du document et sont exportées dans la partie endnotes de Word (numérotation distincte des notes de bas de page)',
    endnotePlaceholder:
      'Saisissez la note de fin. Entrée pour valider, Maj+Entrée pour un saut de ligne',
    endnoteRemove: 'Supprimer la note de fin',
  },
  de: {
    endnote: 'Endnote',
    endnoteEmpty: '(leere Endnote)',
    endnoteInsert: 'Endnote einfügen',
    endnoteEdit: 'Endnote bearbeiten',
    endnoteDialogDesc:
      'Endnoten stehen am Ende des Dokuments und werden als Word-Endnotenteil exportiert (eigene Nummerierung, unabhängig von Fußnoten)',
    endnotePlaceholder:
      'Endnotentext eingeben. Enter bestätigt, Umschalt+Enter für eine neue Zeile',
    endnoteRemove: 'Endnote löschen',
  },
  it: {
    endnote: 'Nota di chiusura',
    endnoteEmpty: '(nota di chiusura vuota)',
    endnoteInsert: 'Inserisci nota di chiusura',
    endnoteEdit: 'Modifica nota di chiusura',
    endnoteDialogDesc:
      'Le note di chiusura compaiono alla fine del documento e vengono esportate nella parte endnotes di Word (numerazione separata dalle note a piè di pagina)',
    endnotePlaceholder:
      'Inserisci il testo della nota. Invio per confermare, Maiusc+Invio per andare a capo',
    endnoteRemove: 'Elimina nota di chiusura',
  },
  es: {
    endnote: 'Nota al final',
    endnoteEmpty: '(nota al final vacía)',
    endnoteInsert: 'Insertar nota al final',
    endnoteEdit: 'Editar nota al final',
    endnoteDialogDesc:
      'Las notas al final aparecen al final del documento y se exportan a la parte endnotes de Word (numeración independiente de las notas al pie)',
    endnotePlaceholder:
      'Escribe el texto de la nota. Intro para confirmar, Mayús+Intro para una línea nueva',
    endnoteRemove: 'Eliminar nota al final',
  },
  pt: {
    endnote: 'Nota de fim',
    endnoteEmpty: '(nota de fim vazia)',
    endnoteInsert: 'Inserir nota de fim',
    endnoteEdit: 'Editar nota de fim',
    endnoteDialogDesc:
      'As notas de fim aparecem no final do documento e são exportadas para a parte endnotes do Word (numeração independente das notas de rodapé)',
    endnotePlaceholder:
      'Digite o texto da nota. Enter para confirmar, Shift+Enter para uma nova linha',
    endnoteRemove: 'Excluir nota de fim',
  },
};
