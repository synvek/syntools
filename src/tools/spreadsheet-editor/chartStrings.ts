/**
 * 图表面板文案：与 strings.ts 分离，避免为新增功能改动整份语言文件。
 * 随工具 chunk 懒加载注册，键路径保持 `tools.sheet.*`。
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

/** 把图表文案合并进 i18next（键路径 tools.sheet.*） */
export function registerChartStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(chartStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
