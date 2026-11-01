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
      chartLine: '折线图',
      chartArea: '面积图',
      chartPie: '饼图',
      chartScatter: '散点图',
      chartRadar: '雷达图',
      chartCombo: '组合图',
      chartSecondary: '次坐标轴',
      chartSecondaryHint: '最后一个系列使用右侧次坐标轴',
      chartImported: '已导入 {{count}} 个图表，可直接编辑',
      chartKept: '另有 {{count}} 个图表按原样保留',
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
      chartLine: 'Line',
      chartArea: 'Area',
      chartPie: 'Pie',
      chartScatter: 'Scatter',
      chartRadar: 'Radar',
      chartCombo: 'Combo',
      chartSecondary: '2nd axis',
      chartSecondaryHint: 'Put the last series on the right-hand secondary axis',
      chartImported: 'Imported {{count}} chart(s) as editable',
      chartKept: 'Kept {{count}} more chart(s) unchanged',
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
      chartLine: '折線圖',
      chartArea: '面積圖',
      chartPie: '圓餅圖',
      chartScatter: '散佈圖',
      chartRadar: '雷達圖',
      chartCombo: '組合圖',
      chartSecondary: '次座標軸',
      chartSecondaryHint: '最後一個數列使用右側次座標軸',
      chartImported: '已匯入 {{count}} 個圖表，可直接編輯',
      chartKept: '另有 {{count}} 個圖表按原樣保留',
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
      chartLine: '折れ線グラフ',
      chartArea: '面グラフ',
      chartPie: '円グラフ',
      chartScatter: '散布図',
      chartRadar: 'レーダー',
      chartCombo: '複合',
      chartSecondary: '第2軸',
      chartSecondaryHint: '最後の系列を右側の第2軸に配置します',
      chartImported: 'グラフ {{count}} 個を編集可能な状態で取り込みました',
      chartKept: 'ほか {{count}} 個のグラフはそのまま保持しました',
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
      chartLine: 'Courbes',
      chartArea: 'Aires',
      chartPie: 'Secteurs',
      chartScatter: 'Nuage de points',
      chartRadar: 'Radar',
      chartCombo: 'Combiné',
      chartSecondary: 'Axe secondaire',
      chartSecondaryHint: 'Placer la dernière série sur l’axe secondaire de droite',
      chartImported: '{{count}} graphique(s) importé(s) et modifiable(s)',
      chartKept: '{{count}} autre(s) graphique(s) conservé(s) tel quel',
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
      chartLine: 'Linie',
      chartArea: 'Fläche',
      chartPie: 'Kreis',
      chartScatter: 'Punkt',
      chartRadar: 'Netz',
      chartCombo: 'Kombi',
      chartSecondary: '2. Achse',
      chartSecondaryHint: 'Letzte Reihe auf der rechten Sekundärachse anzeigen',
      chartImported: '{{count}} Diagramm(e) als bearbeitbar importiert',
      chartKept: '{{count}} weitere(s) Diagramm(e) unverändert erhalten',
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
      chartLine: 'Linee',
      chartArea: 'Area',
      chartPie: 'Torta',
      chartScatter: 'Dispersione',
      chartRadar: 'Radar',
      chartCombo: 'Combinato',
      chartSecondary: 'Asse secondario',
      chartSecondaryHint: 'Metti l’ultima serie sull’asse secondario a destra',
      chartImported: '{{count}} grafico/i importato/i e modificabile/i',
      chartKept: '{{count}} altro/i grafico/i mantenuto/i invariato/i',
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
      chartLine: 'Líneas',
      chartArea: 'Área',
      chartPie: 'Circular',
      chartScatter: 'Dispersión',
      chartRadar: 'Radar',
      chartCombo: 'Combinado',
      chartSecondary: 'Eje secundario',
      chartSecondaryHint: 'Coloca la última serie en el eje secundario derecho',
      chartImported: '{{count}} gráfico(s) importado(s) y editable(s)',
      chartKept: '{{count}} gráfico(s) más conservado(s) tal cual',
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
      chartLine: 'Linhas',
      chartArea: 'Área',
      chartPie: 'Circular',
      chartScatter: 'Dispersión',
      chartRadar: 'Radar',
      chartCombo: 'Combinado',
      chartSecondary: 'Eixo secundário',
      chartSecondaryHint: 'Coloca a última série no eixo secundário à direita',
      chartImported: '{{count}} gráfico(s) importado(s) e editável(is)',
      chartKept: '{{count}} gráfico(s) mantido(s) como estava(m)',
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
