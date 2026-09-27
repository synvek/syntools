/**
 * 文档库 / 版本历史 / 持久化提示文案：与 strings.ts 分离，避免为新增功能改动整份语言文件。
 */

type ResourceTree = { tools: { sheet: Record<string, string> } };
type Registrar = {
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: ResourceTree,
    deep: boolean,
    overwrite: boolean,
  ) => void;
};

const zh: ResourceTree = {
  tools: {
    sheet: {
      library: '文档库',
      libraryNew: '新建',
      libraryClose: '关闭',
      libraryEmpty: '暂无本地工作簿',
      untitledDoc: '未命名工作簿',
      deleteDocConfirm: '确定删除「{{title}}」？该操作不可撤销。',
      duplicateDoc: '复制',
      versions: '历史版本',
      noVersions: '暂无版本记录',
      restoreVersion: '恢复',
      restoreConfirm: '用该版本覆盖当前内容？',
      draftDegraded: '本地存储不可用，草稿未保存；请及时导出 .xlsx 备份',
      draftSaveFailed: '工作簿超出草稿体积上限，未保存到本地；请及时导出 .xlsx 备份',
    },
  },
};

const en: ResourceTree = {
  tools: {
    sheet: {
      library: 'Library',
      libraryNew: 'New',
      libraryClose: 'Close',
      libraryEmpty: 'No local workbooks yet',
      untitledDoc: 'Untitled workbook',
      deleteDocConfirm: 'Delete "{{title}}"? This cannot be undone.',
      duplicateDoc: 'Duplicate',
      versions: 'Version history',
      noVersions: 'No versions yet',
      restoreVersion: 'Restore',
      restoreConfirm: 'Overwrite the current content with this version?',
      draftDegraded:
        'Local storage is unavailable, so the draft was not saved; export .xlsx to keep a copy',
      draftSaveFailed:
        'This workbook exceeds the draft size limit and was not saved locally; export .xlsx to keep a copy',
    },
  },
};

const zhTW: ResourceTree = {
  tools: {
    sheet: {
      library: '文檔庫',
      libraryNew: '新建',
      libraryClose: '關閉',
      libraryEmpty: '暫無本機活頁簿',
      untitledDoc: '未命名活頁簿',
      deleteDocConfirm: '確定刪除「{{title}}」？此操作無法復原。',
      duplicateDoc: '複製',
      versions: '歷史版本',
      noVersions: '尚無版本記錄',
      restoreVersion: '還原',
      restoreConfirm: '用該版本覆蓋目前內容？',
      draftDegraded: '本機儲存不可用，草稿未儲存；請即時匯出 .xlsx 備份',
      draftSaveFailed: '活頁簿超出草稿體積上限，未儲存到本機；請即時匯出 .xlsx 備份',
    },
  },
};

const ja: ResourceTree = {
  tools: {
    sheet: {
      library: 'ライブラリ',
      libraryNew: '新規',
      libraryClose: '閉じる',
      libraryEmpty: 'ローカルブックはまだありません',
      untitledDoc: '無題のブック',
      deleteDocConfirm: '「{{title}}」を削除しますか？元に戻せません。',
      duplicateDoc: '複製',
      versions: 'バージョン履歴',
      noVersions: 'バージョンはまだありません',
      restoreVersion: '復元',
      restoreConfirm: 'このバージョンで現在の内容を上書きしますか？',
      draftDegraded:
        'ローカル保存が利用できないため下書きを保存できません。.xlsx を書き出して保管してください',
      draftSaveFailed:
        'ブックが下書きサイズの上限を超えたため保存できません。.xlsx を書き出して保管してください',
    },
  },
};

const fr: ResourceTree = {
  tools: {
    sheet: {
      library: 'Bibliothèque',
      libraryNew: 'Nouveau',
      libraryClose: 'Fermer',
      libraryEmpty: 'Aucun classeur local',
      untitledDoc: 'Classeur sans titre',
      deleteDocConfirm: 'Supprimer « {{title}} » ? Action irréversible.',
      duplicateDoc: 'Dupliquer',
      versions: 'Historique des versions',
      noVersions: 'Aucune version',
      restoreVersion: 'Restaurer',
      restoreConfirm: 'Remplacer le contenu actuel par cette version ?',
      draftDegraded:
        "Le stockage local est indisponible, le brouillon n'a pas été enregistré ; exportez en .xlsx",
      draftSaveFailed:
        "Ce classeur dépasse la limite du brouillon et n'a pas été enregistré ; exportez en .xlsx",
    },
  },
};

const de: ResourceTree = {
  tools: {
    sheet: {
      library: 'Bibliothek',
      libraryNew: 'Neu',
      libraryClose: 'Schließen',
      libraryEmpty: 'Noch keine lokalen Arbeitsmappen',
      untitledDoc: 'Unbenannte Arbeitsmappe',
      deleteDocConfirm: '„{{title}}“ löschen? Nicht rückgängig zu machen.',
      duplicateDoc: 'Duplizieren',
      versions: 'Versionsverlauf',
      noVersions: 'Noch keine Versionen',
      restoreVersion: 'Wiederherstellen',
      restoreConfirm: 'Aktuellen Inhalt durch diese Version ersetzen?',
      draftDegraded:
        'Lokaler Speicher nicht verfügbar, Entwurf nicht gespeichert; bitte als .xlsx exportieren',
      draftSaveFailed:
        'Arbeitsmappe überschreitet die Entwurfsgrenze und wurde nicht gespeichert; bitte als .xlsx exportieren',
    },
  },
};

const it: ResourceTree = {
  tools: {
    sheet: {
      library: 'Libreria',
      libraryNew: 'Nuovo',
      libraryClose: 'Chiudi',
      libraryEmpty: 'Nessuna cartella locale',
      untitledDoc: 'Cartella senza titolo',
      deleteDocConfirm: 'Eliminare «{{title}}»? Operazione irreversibile.',
      duplicateDoc: 'Duplica',
      versions: 'Cronologia versioni',
      noVersions: 'Nessuna versione',
      restoreVersion: 'Ripristina',
      restoreConfirm: 'Sovrascrivere il contenuto attuale con questa versione?',
      draftDegraded: 'Archivio locale non disponibile, bozza non salvata; esporta in .xlsx',
      draftSaveFailed:
        'La cartella supera il limite della bozza e non è stata salvata; esporta in .xlsx',
    },
  },
};

const es: ResourceTree = {
  tools: {
    sheet: {
      library: 'Biblioteca',
      libraryNew: 'Nuevo',
      libraryClose: 'Cerrar',
      libraryEmpty: 'Aún no hay libros locales',
      untitledDoc: 'Libro sin título',
      deleteDocConfirm: '¿Eliminar «{{title}}»? No se puede deshacer.',
      duplicateDoc: 'Duplicar',
      versions: 'Historial de versiones',
      noVersions: 'Aún no hay versiones',
      restoreVersion: 'Restaurar',
      restoreConfirm: '¿Reemplazar el contenido actual con esta versión?',
      draftDegraded:
        'El almacenamiento local no está disponible, el borrador no se guardó; exporta a .xlsx',
      draftSaveFailed: 'El libro supera el límite del borrador y no se guardó; exporta a .xlsx',
    },
  },
};

const pt: ResourceTree = {
  tools: {
    sheet: {
      library: 'Biblioteca',
      libraryNew: 'Novo',
      libraryClose: 'Fechar',
      libraryEmpty: 'Ainda sem livros locais',
      untitledDoc: 'Livro sem título',
      deleteDocConfirm: 'Eliminar «{{title}}»? Ação irreversível.',
      duplicateDoc: 'Duplicar',
      versions: 'Histórico de versões',
      noVersions: 'Ainda sem versões',
      restoreVersion: 'Restaurar',
      restoreConfirm: 'Substituir o conteúdo atual por esta versão?',
      draftDegraded: 'Armazenamento local indisponível, rascunho não guardado; exporte para .xlsx',
      draftSaveFailed: 'O livro excede o limite do rascunho e não foi guardado; exporte para .xlsx',
    },
  },
};

export const storeStrings: Record<string, ResourceTree> = {
  zh,
  en,
  'zh-TW': zhTW,
  ja,
  fr,
  de,
  it,
  es,
  pt,
};

/** 把文档库相关文案合并进 i18next（键路径 tools.sheet.*） */
export function registerStoreStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(storeStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
