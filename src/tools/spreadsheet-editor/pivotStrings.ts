/**
 * Pivot panel copy: kept apart from strings.ts so adding a feature does not touch the whole locale
 * file. Registered lazily with the tool chunk, with keys under `tools.sheet.*`.
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
      insertPivot: '插入透视表',
      pivotTitle: '透视表',
      pivotSource: '源数据',
      pivotUseSelection: '用当前选区',
      pivotRefresh: '刷新',
      pivotRows: '行',
      pivotCols: '列',
      pivotValues: '值',
      pivotFilters: '筛选',
      pivotFieldHint: '拖动字段到行 / 列 / 值 / 筛选，或点击字段右侧按钮',
      pivotBlank: '(空白)',
      pivotSum: '求和',
      pivotCount: '计数',
      pivotAvg: '平均值',
      pivotMin: '最小值',
      pivotMax: '最大值',
      pivotGrandTotal: '总计',
      pivotEmpty: '源区域没有可用数据：请先选中包含表头的数据区域',
      pivotTruncated: '源区域超过 5 万单元格，只聚合了前 {{count}} 行',
      pivotSkipped: '{{count}} 个非数值单元格未参与{{aggregation}}',
      pivotRemove: '删除透视表',
      pivotClose: '关闭',
      pivotExportXlsx: '连同透视表导出 xlsx',
      pivotSnapshot: '透视表以静态值导出，在 Excel 中不可刷新',
    },
  },
};

const en: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Insert pivot table',
      pivotTitle: 'Pivot table',
      pivotSource: 'Source',
      pivotUseSelection: 'Use current selection',
      pivotRefresh: 'Refresh',
      pivotRows: 'Rows',
      pivotCols: 'Columns',
      pivotValues: 'Values',
      pivotFilters: 'Filters',
      pivotFieldHint: 'Drag a field into rows / columns / values / filters, or use the buttons',
      pivotBlank: '(blank)',
      pivotSum: 'Sum',
      pivotCount: 'Count',
      pivotAvg: 'Average',
      pivotMin: 'Min',
      pivotMax: 'Max',
      pivotGrandTotal: 'Grand total',
      pivotEmpty: 'No data in the source range: select a range that includes headers first',
      pivotTruncated: 'Source exceeds 50k cells, only the first {{count}} rows were aggregated',
      pivotSkipped: '{{count}} non-numeric cells were skipped for {{aggregation}}',
      pivotRemove: 'Remove pivot table',
      pivotClose: 'Close',
      pivotExportXlsx: 'Export xlsx with this pivot',
      pivotSnapshot: 'The pivot is exported as static values and cannot be refreshed in Excel',
    },
  },
};

const zhTW: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: '插入樞紐分析表',
      pivotTitle: '樞紐分析表',
      pivotSource: '來源資料',
      pivotUseSelection: '用目前選取範圍',
      pivotRefresh: '重新整理',
      pivotRows: '列',
      pivotCols: '欄',
      pivotValues: '值',
      pivotFilters: '篩選',
      pivotFieldHint: '將欄位拖到列 / 欄 / 值 / 篩選，或點欄位右側按鈕',
      pivotBlank: '(空白)',
      pivotSum: '加總',
      pivotCount: '計數',
      pivotAvg: '平均值',
      pivotMin: '最小值',
      pivotMax: '最大值',
      pivotGrandTotal: '總計',
      pivotEmpty: '來源範圍沒有可用資料：請先選取含標題的資料範圍',
      pivotTruncated: '來源範圍超過 5 萬儲存格，只彙總了前 {{count}} 列',
      pivotSkipped: '{{count}} 個非數值儲存格未參與{{aggregation}}',
      pivotRemove: '刪除樞紐分析表',
      pivotClose: '關閉',
      pivotExportXlsx: '連同樞紐分析表匯出 xlsx',
      pivotSnapshot: '樞紐分析表以靜態值匯出，在 Excel 中無法重新整理',
    },
  },
};

const ja: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'ピボットテーブルの挿入',
      pivotTitle: 'ピボットテーブル',
      pivotSource: 'ソース',
      pivotUseSelection: '現在の選択範囲を使用',
      pivotRefresh: '更新',
      pivotRows: '行',
      pivotCols: '列',
      pivotValues: '値',
      pivotFilters: 'フィルター',
      pivotFieldHint:
        'フィールドを行 / 列 / 値 / フィルターへドラッグするか、右側のボタンを使用します',
      pivotBlank: '(空白)',
      pivotSum: '合計',
      pivotCount: '個数',
      pivotAvg: '平均',
      pivotMin: '最小',
      pivotMax: '最大',
      pivotGrandTotal: '総計',
      pivotEmpty: 'ソース範囲にデータがありません。見出しを含む範囲を選択してください',
      pivotTruncated: 'ソースが 5 万セルを超えるため、先頭 {{count}} 行のみ集計しました',
      pivotSkipped: '{{count}} 個の非数値セルは{{aggregation}}に含まれていません',
      pivotRemove: 'ピボットテーブルを削除',
      pivotClose: '閉じる',
      pivotExportXlsx: 'ピボット付きで xlsx を書き出す',
      pivotSnapshot: 'ピボットは静的な値として書き出されるため、Excel で更新できません',
    },
  },
};

const fr: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Insérer un tableau croisé dynamique',
      pivotTitle: 'Tableau croisé dynamique',
      pivotSource: 'Source',
      pivotUseSelection: 'Utiliser la sélection',
      pivotRefresh: 'Actualiser',
      pivotRows: 'Lignes',
      pivotCols: 'Colonnes',
      pivotValues: 'Valeurs',
      pivotFilters: 'Filtres',
      pivotFieldHint:
        'Glissez un champ vers lignes / colonnes / valeurs / filtres, ou utilisez les boutons',
      pivotBlank: '(vide)',
      pivotSum: 'Somme',
      pivotCount: 'Nombre',
      pivotAvg: 'Moyenne',
      pivotMin: 'Min',
      pivotMax: 'Max',
      pivotGrandTotal: 'Total général',
      pivotEmpty:
        'Aucune donnée dans la plage source : sélectionnez d’abord une plage avec en-têtes',
      pivotTruncated:
        'La source dépasse 50 000 cellules, seules les {{count}} premières lignes sont agrégées',
      pivotSkipped: '{{count}} cellules non numériques ignorées pour {{aggregation}}',
      pivotRemove: 'Supprimer le tableau croisé',
      pivotClose: 'Fermer',
      pivotExportXlsx: 'Exporter le xlsx avec ce tableau',
      pivotSnapshot:
        'Le tableau est exporté en valeurs statiques et ne peut pas être actualisé dans Excel',
    },
  },
};

const de: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Pivot-Tabelle einfügen',
      pivotTitle: 'Pivot-Tabelle',
      pivotSource: 'Quelle',
      pivotUseSelection: 'Aktuelle Auswahl verwenden',
      pivotRefresh: 'Aktualisieren',
      pivotRows: 'Zeilen',
      pivotCols: 'Spalten',
      pivotValues: 'Werte',
      pivotFilters: 'Filter',
      pivotFieldHint:
        'Feld in Zeilen / Spalten / Werte / Filter ziehen oder die Schaltflächen nutzen',
      pivotBlank: '(leer)',
      pivotSum: 'Summe',
      pivotCount: 'Anzahl',
      pivotAvg: 'Mittelwert',
      pivotMin: 'Min',
      pivotMax: 'Max',
      pivotGrandTotal: 'Gesamtergebnis',
      pivotEmpty: 'Keine Daten im Quellbereich: zuerst einen Bereich mit Überschriften auswählen',
      pivotTruncated:
        'Quelle überschreitet 50.000 Zellen, nur die ersten {{count}} Zeilen wurden aggregiert',
      pivotSkipped: '{{count}} nicht numerische Zellen wurden für {{aggregation}} übersprungen',
      pivotRemove: 'Pivot-Tabelle entfernen',
      pivotClose: 'Schließen',
      pivotExportXlsx: 'xlsx mit dieser Pivot-Tabelle exportieren',
      pivotSnapshot:
        'Die Pivot-Tabelle wird als statische Werte exportiert und lässt sich in Excel nicht aktualisieren',
    },
  },
};

const it: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Inserisci tabella pivot',
      pivotTitle: 'Tabella pivot',
      pivotSource: 'Origine',
      pivotUseSelection: 'Usa la selezione corrente',
      pivotRefresh: 'Aggiorna',
      pivotRows: 'Righe',
      pivotCols: 'Colonne',
      pivotValues: 'Valori',
      pivotFilters: 'Filtri',
      pivotFieldHint:
        'Trascina un campo in righe / colonne / valori / filtri, oppure usa i pulsanti',
      pivotBlank: '(vuoto)',
      pivotSum: 'Somma',
      pivotCount: 'Conteggio',
      pivotAvg: 'Media',
      pivotMin: 'Min',
      pivotMax: 'Max',
      pivotGrandTotal: 'Totale complessivo',
      pivotEmpty:
        'Nessun dato nell’intervallo di origine: seleziona prima un intervallo con intestazioni',
      pivotTruncated:
        'L’origine supera 50.000 celle, sono state aggregate solo le prime {{count}} righe',
      pivotSkipped: '{{count}} celle non numeriche escluse da {{aggregation}}',
      pivotRemove: 'Rimuovi tabella pivot',
      pivotClose: 'Chiudi',
      pivotExportXlsx: 'Esporta xlsx con la tabella pivot',
      pivotSnapshot: 'La tabella viene esportata come valori statici e non è aggiornabile in Excel',
    },
  },
};

const es: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Insertar tabla dinámica',
      pivotTitle: 'Tabla dinámica',
      pivotSource: 'Origen',
      pivotUseSelection: 'Usar la selección actual',
      pivotRefresh: 'Actualizar',
      pivotRows: 'Filas',
      pivotCols: 'Columnas',
      pivotValues: 'Valores',
      pivotFilters: 'Filtros',
      pivotFieldHint: 'Arrastra un campo a filas / columnas / valores / filtros, o usa los botones',
      pivotBlank: '(vacío)',
      pivotSum: 'Suma',
      pivotCount: 'Recuento',
      pivotAvg: 'Promedio',
      pivotMin: 'Mín',
      pivotMax: 'Máx',
      pivotGrandTotal: 'Total general',
      pivotEmpty: 'No hay datos en el rango de origen: selecciona primero un rango con encabezados',
      pivotTruncated:
        'El origen supera 50.000 celdas, solo se agregaron las primeras {{count}} filas',
      pivotSkipped: '{{count}} celdas no numéricas se omitieron en {{aggregation}}',
      pivotRemove: 'Eliminar tabla dinámica',
      pivotClose: 'Cerrar',
      pivotExportXlsx: 'Exportar xlsx con esta tabla',
      pivotSnapshot: 'La tabla se exporta como valores estáticos y no se puede actualizar en Excel',
    },
  },
};

const pt: ResourceTree = {
  tools: {
    sheet: {
      insertPivot: 'Inserir tabela dinâmica',
      pivotTitle: 'Tabela dinâmica',
      pivotSource: 'Origem',
      pivotUseSelection: 'Usar a seleção atual',
      pivotRefresh: 'Atualizar',
      pivotRows: 'Linhas',
      pivotCols: 'Colunas',
      pivotValues: 'Valores',
      pivotFilters: 'Filtros',
      pivotFieldHint:
        'Arraste um campo para linhas / colunas / valores / filtros, ou use os botões',
      pivotBlank: '(vazio)',
      pivotSum: 'Soma',
      pivotCount: 'Contagem',
      pivotAvg: 'Média',
      pivotMin: 'Mín',
      pivotMax: 'Máx',
      pivotGrandTotal: 'Total geral',
      pivotEmpty:
        'Sem dados no intervalo de origem: selecione primeiro um intervalo com cabeçalhos',
      pivotTruncated:
        'A origem excede 50.000 células, apenas as primeiras {{count}} linhas foram agregadas',
      pivotSkipped: '{{count}} células não numéricas foram ignoradas em {{aggregation}}',
      pivotRemove: 'Remover tabela dinâmica',
      pivotClose: 'Fechar',
      pivotExportXlsx: 'Exportar xlsx com esta tabela',
      pivotSnapshot:
        'A tabela é exportada como valores estáticos e não pode ser atualizada no Excel',
    },
  },
};

export const pivotStrings: Record<string, ResourceTree> = {
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

/** Merge the pivot copy into i18next (keys under tools.sheet.*) */
export function registerPivotStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(pivotStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
