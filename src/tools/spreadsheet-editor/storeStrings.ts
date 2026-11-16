/**
 * Document library / version history / persistence notice copy: kept apart from strings.ts so adding
 * a feature does not touch the whole locale file.
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
      templates: '从模板新建',
      templateBudget: '预算表',
      templateSales: '销售透视',
      templateSchedule: '项目排期',
      untitledDoc: '未命名工作簿',
      copySuffix: ' 副本',
      deleteDocConfirm: '确定删除「{{title}}」？该操作不可撤销。',
      duplicateDoc: '复制',
      versions: '历史版本',
      noVersions: '暂无版本记录',
      restoreVersion: '恢复',
      restoreConfirm: '用该版本覆盖当前内容？',
      storeUnavailable: '本地文档库不可用（浏览器禁用了 IndexedDB），改动只会留在草稿里',
      storeQuota: '本地文档库空间不足，刚才的改动没能存进文档库',
      storeRetry: '重试',
      storageUsage: '本地已用 {{used}} / 可用 {{quota}}',
      deleteVersion: '删除该版本',
      clearVersions: '清空旧版本',
      clearVersionsConfirm: '删除本文档的全部历史版本？当前内容不受影响。',
      deleteOldVersions: '删除旧版本',
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
      templates: 'Start from a template',
      templateBudget: 'Budget',
      templateSales: 'Sales pivot',
      templateSchedule: 'Project schedule',
      untitledDoc: 'Untitled workbook',
      copySuffix: ' copy',
      deleteDocConfirm: 'Delete "{{title}}"? This cannot be undone.',
      duplicateDoc: 'Duplicate',
      versions: 'Version history',
      noVersions: 'No versions yet',
      restoreVersion: 'Restore',
      restoreConfirm: 'Overwrite the current content with this version?',
      storeUnavailable:
        'The local library is unavailable (IndexedDB is blocked), so changes stay in the draft only',
      storeQuota: 'The local library is out of space, so your last change was not saved to it',
      storeRetry: 'Retry',
      storageUsage: 'Using {{used}} of {{quota}}',
      deleteVersion: 'Delete this version',
      clearVersions: 'Clear old versions',
      clearVersionsConfirm:
        'Delete every saved version of this workbook? The current content is kept.',
      deleteOldVersions: 'Delete old versions',
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
      templates: '從模板新建',
      templateBudget: '預算表',
      templateSales: '銷售樞紐',
      templateSchedule: '專案排期',
      untitledDoc: '未命名活頁簿',
      copySuffix: ' 副本',
      deleteDocConfirm: '確定刪除「{{title}}」？此操作無法復原。',
      duplicateDoc: '複製',
      versions: '歷史版本',
      noVersions: '尚無版本記錄',
      restoreVersion: '還原',
      restoreConfirm: '用該版本覆蓋目前內容？',
      storeUnavailable: '本機文檔庫無法使用（瀏覽器停用了 IndexedDB），變更只會留在草稿裡',
      storeQuota: '本機文檔庫空間不足，剛才的變更沒有存進文檔庫',
      storeRetry: '重試',
      storageUsage: '本機已用 {{used}} / 可用 {{quota}}',
      deleteVersion: '刪除這個版本',
      clearVersions: '清除舊版本',
      clearVersionsConfirm: '刪除這份文檔的全部歷史版本？目前內容不受影響。',
      deleteOldVersions: '刪除舊版本',
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
      templates: 'テンプレートから作成',
      templateBudget: '予算表',
      templateSales: '売上ピボット',
      templateSchedule: 'プロジェクト日程',
      untitledDoc: '無題のブック',
      copySuffix: ' のコピー',
      deleteDocConfirm: '「{{title}}」を削除しますか？元に戻せません。',
      duplicateDoc: '複製',
      versions: 'バージョン履歴',
      noVersions: 'バージョンはまだありません',
      restoreVersion: '復元',
      restoreConfirm: 'このバージョンで現在の内容を上書きしますか？',
      storeUnavailable:
        'ローカル文書ライブラリを利用できません（IndexedDB が無効）。変更は下書きにのみ残ります',
      storeQuota:
        'ローカル文書ライブラリの空き容量が不足しています。直前の変更は保存されませんでした',
      storeRetry: '再試行',
      storageUsage: '使用中 {{used}} / 上限 {{quota}}',
      deleteVersion: 'このバージョンを削除',
      clearVersions: '古いバージョンを削除',
      clearVersionsConfirm: 'このブックのすべての履歴を削除しますか？現在の内容は残ります。',
      deleteOldVersions: '古いバージョンを削除',
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
      templates: 'Créer depuis un modèle',
      templateBudget: 'Budget',
      templateSales: 'Tableau croisé des ventes',
      templateSchedule: 'Planning de projet',
      untitledDoc: 'Classeur sans titre',
      copySuffix: ' (copie)',
      deleteDocConfirm: 'Supprimer « {{title}} » ? Action irréversible.',
      duplicateDoc: 'Dupliquer',
      versions: 'Historique des versions',
      noVersions: 'Aucune version',
      restoreVersion: 'Restaurer',
      restoreConfirm: 'Remplacer le contenu actuel par cette version ?',
      storeUnavailable:
        'La bibliothèque locale est indisponible (IndexedDB bloqué) : les modifications restent dans le brouillon',
      storeQuota:
        "La bibliothèque locale est pleine : la dernière modification n'a pas été enregistrée",
      storeRetry: 'Réessayer',
      storageUsage: '{{used}} utilisés sur {{quota}}',
      deleteVersion: 'Supprimer cette version',
      clearVersions: 'Vider les anciennes versions',
      clearVersionsConfirm:
        'Supprimer toutes les versions enregistrées de ce classeur ? Le contenu actuel est conservé.',
      deleteOldVersions: 'Supprimer les anciennes versions',
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
      templates: 'Aus Vorlage erstellen',
      templateBudget: 'Budget',
      templateSales: 'Umsatz-Pivot',
      templateSchedule: 'Projektplan',
      untitledDoc: 'Unbenannte Arbeitsmappe',
      copySuffix: ' (Kopie)',
      deleteDocConfirm: '„{{title}}“ löschen? Nicht rückgängig zu machen.',
      duplicateDoc: 'Duplizieren',
      versions: 'Versionsverlauf',
      noVersions: 'Noch keine Versionen',
      restoreVersion: 'Wiederherstellen',
      restoreConfirm: 'Aktuellen Inhalt durch diese Version ersetzen?',
      storeUnavailable:
        'Die lokale Bibliothek ist nicht verfügbar (IndexedDB blockiert); Änderungen bleiben nur im Entwurf',
      storeQuota: 'Die lokale Bibliothek ist voll; die letzte Änderung wurde nicht gespeichert',
      storeRetry: 'Erneut versuchen',
      storageUsage: '{{used}} von {{quota}} belegt',
      deleteVersion: 'Diese Version löschen',
      clearVersions: 'Alte Versionen löschen',
      clearVersionsConfirm:
        'Alle gespeicherten Versionen dieser Arbeitsmappe löschen? Der aktuelle Inhalt bleibt erhalten.',
      deleteOldVersions: 'Alte Versionen löschen',
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
      templates: 'Crea da modello',
      templateBudget: 'Budget',
      templateSales: 'Pivot vendite',
      templateSchedule: 'Pianificazione progetto',
      untitledDoc: 'Cartella senza titolo',
      copySuffix: ' (copia)',
      deleteDocConfirm: 'Eliminare «{{title}}»? Operazione irreversibile.',
      duplicateDoc: 'Duplica',
      versions: 'Cronologia versioni',
      noVersions: 'Nessuna versione',
      restoreVersion: 'Ripristina',
      restoreConfirm: 'Sovrascrivere il contenuto attuale con questa versione?',
      storeUnavailable:
        'La libreria locale non è disponibile (IndexedDB bloccato): le modifiche restano nella bozza',
      storeQuota: "La libreria locale è piena: l'ultima modifica non è stata salvata",
      storeRetry: 'Riprova',
      storageUsage: '{{used}} di {{quota}} usati',
      deleteVersion: 'Elimina questa versione',
      clearVersions: 'Elimina le versioni vecchie',
      clearVersionsConfirm:
        'Eliminare tutte le versioni salvate di questa cartella? Il contenuto attuale resta.',
      deleteOldVersions: 'Elimina le versioni vecchie',
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
      templates: 'Crear desde plantilla',
      templateBudget: 'Presupuesto',
      templateSales: 'Tabla dinámica de ventas',
      templateSchedule: 'Calendario del proyecto',
      untitledDoc: 'Libro sin título',
      copySuffix: ' (copia)',
      deleteDocConfirm: '¿Eliminar «{{title}}»? No se puede deshacer.',
      duplicateDoc: 'Duplicar',
      versions: 'Historial de versiones',
      noVersions: 'Aún no hay versiones',
      restoreVersion: 'Restaurar',
      restoreConfirm: '¿Reemplazar el contenido actual con esta versión?',
      storeUnavailable:
        'La biblioteca local no está disponible (IndexedDB bloqueado): los cambios solo quedan en el borrador',
      storeQuota: 'La biblioteca local se ha quedado sin espacio: el último cambio no se guardó',
      storeRetry: 'Reintentar',
      storageUsage: '{{used}} de {{quota}} usados',
      deleteVersion: 'Eliminar esta versión',
      clearVersions: 'Borrar versiones antiguas',
      clearVersionsConfirm:
        '¿Eliminar todas las versiones guardadas de este libro? El contenido actual se conserva.',
      deleteOldVersions: 'Borrar versiones antiguas',
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
      templates: 'Criar a partir de modelo',
      templateBudget: 'Orçamento',
      templateSales: 'Tabela dinâmica de vendas',
      templateSchedule: 'Cronograma do projeto',
      untitledDoc: 'Livro sem título',
      copySuffix: ' (cópia)',
      deleteDocConfirm: 'Eliminar «{{title}}»? Ação irreversível.',
      duplicateDoc: 'Duplicar',
      versions: 'Histórico de versões',
      noVersions: 'Ainda sem versões',
      restoreVersion: 'Restaurar',
      restoreConfirm: 'Substituir o conteúdo atual por esta versão?',
      storeUnavailable:
        'A biblioteca local não está disponível (IndexedDB bloqueado): as alterações ficam apenas no rascunho',
      storeQuota: 'A biblioteca local está sem espaço: a última alteração não foi guardada',
      storeRetry: 'Tentar novamente',
      storageUsage: '{{used}} de {{quota}} usados',
      deleteVersion: 'Eliminar esta versão',
      clearVersions: 'Limpar versões antigas',
      clearVersionsConfirm:
        'Eliminar todas as versões guardadas deste livro? O conteúdo atual mantém-se.',
      deleteOldVersions: 'Eliminar versões antigas',
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

/** Merge the document-library copy into i18next (keys under tools.sheet.*) */
export function registerStoreStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(storeStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
