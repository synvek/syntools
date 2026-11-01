/**
 * Chart panel copy: kept apart from strings.ts so adding a feature does not touch the whole locale
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
      insertChart: '插入图表',
      chartBar: '柱状图',
      chartScatter: '散点图',
      chartRadar: '雷达图',
      chartCombo: '组合图',
      chartImported: '已保留 {{count}} 个原生图表（导出后可在 Excel 中编辑）',
      chartLine: '折线图',
      chartPie: '饼图',
      chartExportPng: '导出图片',
      chartEmpty: '请先选中包含数据的单元格区域',
      chartRange: '数据区域',
      chartDragHint: '拖动标题栏移动图表，拖右下角调整大小',
      chartUseSelection: '用当前选区',
      chartRemove: '删除图表',
    },
  },
};

const en: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Insert chart',
      chartBar: 'Bar',
      chartScatter: 'Scatter',
      chartRadar: 'Radar',
      chartCombo: 'Combo',
      chartImported: 'Preserved {{count}} native chart(s) — still editable in Excel',
      chartLine: 'Line',
      chartPie: 'Pie',
      chartExportPng: 'Export image',
      chartEmpty: 'Select a cell range that contains data first',
      chartRange: 'Data range',
      chartDragHint: 'Drag the title bar to move, drag the corner to resize',
      chartUseSelection: 'Use current selection',
      chartRemove: 'Remove chart',
    },
  },
};

const zhTW: ResourceTree = {
  tools: {
    sheet: {
      insertChart: '插入圖表',
      chartBar: '柱狀圖',
      chartScatter: '散佈圖',
      chartRadar: '雷達圖',
      chartCombo: '組合圖',
      chartImported: '已保留 {{count}} 個原生圖表（匯出後可在 Excel 中編輯）',
      chartLine: '折線圖',
      chartPie: '圓餅圖',
      chartExportPng: '匯出圖片',
      chartEmpty: '請先選取包含資料的儲存格範圍',
      chartRange: '資料範圍',
      chartDragHint: '拖曳標題列移動圖表，拖右下角調整大小',
      chartUseSelection: '用目前選取範圍',
      chartRemove: '刪除圖表',
    },
  },
};

const ja: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'グラフを挿入',
      chartBar: '棒グラフ',
      chartScatter: '散布図',
      chartRadar: 'レーダー',
      chartCombo: '複合',
      chartImported: 'ネイティブグラフ {{count}} 個を保持しました（Excel では編集できます）',
      chartLine: '折れ線グラフ',
      chartPie: '円グラフ',
      chartExportPng: '画像を書き出す',
      chartEmpty: '先にデータを含むセル範囲を選択してください',
      chartRange: 'データ範囲',
      chartDragHint: 'タイトルバーをドラッグして移動、右下をドラッグしてサイズ変更',
      chartUseSelection: '現在の選択範囲を使用',
      chartRemove: 'グラフを削除',
    },
  },
};

const fr: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Insérer un graphique',
      chartBar: 'Barres',
      chartScatter: 'Nuage de points',
      chartRadar: 'Radar',
      chartCombo: 'Combiné',
      chartImported: '{{count}} graphique(s) natif(s) conservé(s) — modifiables dans Excel',
      chartLine: 'Courbes',
      chartPie: 'Secteurs',
      chartExportPng: "Exporter l'image",
      chartEmpty: "Sélectionnez d'abord une plage de cellules contenant des données",
      chartRange: 'Plage de données',
      chartDragHint: 'Faites glisser la barre de titre pour déplacer, le coin pour redimensionner',
      chartUseSelection: 'Utiliser la sélection',
      chartRemove: 'Supprimer le graphique',
    },
  },
};

const de: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Diagramm einfügen',
      chartBar: 'Balken',
      chartScatter: 'Punkt',
      chartRadar: 'Netz',
      chartCombo: 'Kombi',
      chartImported: '{{count}} native(s) Diagramm(e) erhalten — in Excel weiter bearbeitbar',
      chartLine: 'Linie',
      chartPie: 'Kreis',
      chartExportPng: 'Bild exportieren',
      chartEmpty: 'Bitte zuerst einen Zellbereich mit Daten auswählen',
      chartRange: 'Datenbereich',
      chartDragHint: 'Titelleiste zum Verschieben ziehen, Ecke zum Größenändern',
      chartUseSelection: 'Aktuelle Auswahl verwenden',
      chartRemove: 'Diagramm entfernen',
    },
  },
};

const it: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Inserisci grafico',
      chartBar: 'Barre',
      chartScatter: 'Dispersione',
      chartRadar: 'Radar',
      chartCombo: 'Combinato',
      chartImported: '{{count}} grafico/i nativo/i conservato/i — modificabile in Excel',
      chartLine: 'Linee',
      chartPie: 'Torta',
      chartExportPng: 'Esporta immagine',
      chartEmpty: 'Seleziona prima un intervallo di celle con dati',
      chartRange: 'Intervallo dati',
      chartDragHint: 'Trascina la barra del titolo per spostare, l’angolo per ridimensionare',
      chartUseSelection: 'Usa selezione corrente',
      chartRemove: 'Rimuovi grafico',
    },
  },
};

const es: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Insertar gráfico',
      chartBar: 'Barras',
      chartScatter: 'Dispersión',
      chartRadar: 'Radar',
      chartCombo: 'Combinado',
      chartImported: '{{count}} gráfico(s) nativo(s) conservado(s) — editable en Excel',
      chartLine: 'Líneas',
      chartPie: 'Circular',
      chartExportPng: 'Exportar imagen',
      chartEmpty: 'Selecciona primero un rango de celdas con datos',
      chartRange: 'Rango de datos',
      chartDragHint: 'Arrastra la barra de título para mover, la esquina para redimensionar',
      chartUseSelection: 'Usar selección actual',
      chartRemove: 'Eliminar gráfico',
    },
  },
};

const pt: ResourceTree = {
  tools: {
    sheet: {
      insertChart: 'Inserir gráfico',
      chartBar: 'Barras',
      chartScatter: 'Dispersión',
      chartRadar: 'Radar',
      chartCombo: 'Combinado',
      chartImported: '{{count}} gráfico(s) nativo(s) preservado(s) — editável no Excel',
      chartLine: 'Linhas',
      chartPie: 'Circular',
      chartExportPng: 'Exportar imagem',
      chartEmpty: 'Selecione primeiro um intervalo de células com dados',
      chartRange: 'Intervalo de dados',
      chartDragHint: 'Arraste a barra de título para mover, o canto para redimensionar',
      chartUseSelection: 'Usar seleção atual',
      chartRemove: 'Remover gráfico',
    },
  },
};

export const chartStrings: Record<string, ResourceTree> = {
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

/** Merge the chart copy into i18next (keys under tools.sheet.*) */
export function registerChartStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(chartStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
