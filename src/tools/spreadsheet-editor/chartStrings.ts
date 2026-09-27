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
