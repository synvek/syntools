/**
 * 电子表格编辑器 UI 文案：随工具 chunk 懒加载注入 i18next。
 *
 * 与富文本编辑器同理：zh / en 是首屏同步语言包，单工具的界面文案若写入
 * `core/i18n/locales/*` 会直接推高首屏入口体积（预算 180KB，实测已接近上限）。
 * 因此放在这里，工具懒加载时由 `registerSpreadsheetStrings` 合并进 i18next，
 * 键路径保持 `tools.sheet.*`，并保留 10 种语言。
 */

type StringTree = { [key: string]: string | StringTree };
type ResourceTree = { tools: { sheet: StringTree } };

const err = (messages: Record<string, string>): StringTree => ({ ...messages });

const zh: ResourceTree = {
  tools: {
    sheet: {
      docTitle: '工作簿名称',
      present: '放映',
      exitPresent: '退出放映（Esc）',
      presentLoading: '正在生成放映画面…',
      presentFailed: '放映画面生成失败',
      titlePlaceholder: '未命名工作簿',
      importHint: '拖入或选择 .xlsx / .csv 文件导入表格内容',
      importXlsx: '导入表格 (.xlsx / .csv)',
      newSheet: '新建空白表格',
      addSheet: '新建工作表',
      rename: '重命名',
      duplicate: '复制工作表',
      delete: '删除工作表',
      hiddenSheet: '已隐藏',
      sheets: '工作表',
      rows: '行',
      columns: '列',
      cells: '单元格',
      formulas: '公式',
      exportXlsx: '导出 Excel (.xlsx)',
      exportCsv: '导出 CSV',
      exporting: '处理中…',
      ready: '编辑内容会自动保留在当前页面',
      unsupportedTip:
        '暂不支持图片与透视表；本工具内新建的图表、条件格式与数据验证不会写入导出文件',
      err: err({
        EMPTY: '工作簿为空',
        NOT_XLSX: '仅支持 .xlsx 文件',
        UNSUPPORTED_LEGACY_XLS: '暂不支持旧版 .xls / .et，请另存为 .xlsx 后重试',
        TOO_LARGE: '文件超出 {{max}}MB 限制',
        IMPORT_FAILED: '文件解析失败',
        EXPORT_FAILED: 'Excel 导出失败',
        SNAPSHOT_FAILED: '表格数据读取失败',
        RUNTIME_FAILED: '表格引擎启动失败',
      }),
    },
  },
};

const en: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Workbook name',
      present: 'Present',
      exitPresent: 'Exit (Esc)',
      presentLoading: 'Preparing the slideshow…',
      presentFailed: 'Failed to build the slideshow',
      titlePlaceholder: 'Untitled workbook',
      importHint: 'Drop or pick a .xlsx / .csv file to import sheet content',
      importXlsx: 'Import sheet (.xlsx / .csv)',
      newSheet: 'New blank workbook',
      addSheet: 'Add sheet',
      rename: 'Rename',
      duplicate: 'Duplicate sheet',
      delete: 'Delete sheet',
      hiddenSheet: 'hidden',
      sheets: 'Sheets',
      rows: 'Rows',
      columns: 'Columns',
      cells: 'Cells',
      formulas: 'Formulas',
      exportXlsx: 'Export Excel (.xlsx)',
      exportCsv: 'Export CSV',
      exporting: 'Working…',
      ready: 'Edits stay on this page',
      unsupportedTip:
        'Images and pivot tables are not supported; charts, conditional formatting and data validation created in this tool are not written to exported files',
      err: err({
        EMPTY: 'The workbook is empty',
        NOT_XLSX: 'Only .xlsx files are supported',
        UNSUPPORTED_LEGACY_XLS: 'Legacy .xls / .et is not supported, please save as .xlsx',
        TOO_LARGE: 'File exceeds the {{max}}MB limit',
        IMPORT_FAILED: 'Failed to parse the file',
        EXPORT_FAILED: 'Excel export failed',
        SNAPSHOT_FAILED: 'Failed to read sheet data',
        RUNTIME_FAILED: 'Failed to start the sheet engine',
      }),
    },
  },
};

const zhTW: ResourceTree = {
  tools: {
    sheet: {
      docTitle: '活頁簿名稱',
      present: '放映',
      exitPresent: '結束放映（Esc）',
      presentLoading: '正在產生放映畫面…',
      presentFailed: '放映畫面產生失敗',
      titlePlaceholder: '未命名活頁簿',
      importHint: '拖曳或選擇 .xlsx / .csv 檔案匯入表格內容',
      importXlsx: '匯入表格 (.xlsx / .csv)',
      newSheet: '新增空白表格',
      addSheet: '新增工作表',
      rename: '重新命名',
      duplicate: '複製工作表',
      delete: '刪除工作表',
      hiddenSheet: '已隱藏',
      sheets: '工作表',
      rows: '列',
      columns: '欄',
      cells: '儲存格',
      formulas: '公式',
      exportXlsx: '匯出 Excel (.xlsx)',
      exportCsv: '匯出 CSV',
      exporting: '處理中…',
      ready: '編輯內容會保留在目前頁面',
      unsupportedTip:
        '不支援圖片與樞紐分析表；本工具內新建的圖表、條件式格式與資料驗證不會寫入匯出檔案',
      err: err({
        EMPTY: '活頁簿為空',
        NOT_XLSX: '僅支援 .xlsx 檔案',
        UNSUPPORTED_LEGACY_XLS: '不支援舊版 .xls / .et，請另存為 .xlsx 後再試',
        TOO_LARGE: '檔案超過 {{max}}MB 限制',
        IMPORT_FAILED: '檔案解析失敗',
        EXPORT_FAILED: 'Excel 匯出失敗',
        SNAPSHOT_FAILED: '讀取表格資料失敗',
        RUNTIME_FAILED: '表格引擎啟動失敗',
      }),
    },
  },
};

const ja: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'ブック名',
      present: 'スライドショー',
      exitPresent: '終了（Esc）',
      presentLoading: '表示用の画像を生成中…',
      presentFailed: '表示用の画像の生成に失敗しました',
      titlePlaceholder: '無題のブック',
      importHint: '.xlsx / .csv ファイルをドロップまたは選択して表の内容を読み込む',
      importXlsx: '表を読み込む (.xlsx / .csv)',
      newSheet: '新しい空のブック',
      addSheet: 'シートを追加',
      rename: '名前の変更',
      duplicate: 'シートを複製',
      delete: 'シートを削除',
      hiddenSheet: '非表示',
      sheets: 'シート',
      rows: '行',
      columns: '列',
      cells: 'セル',
      formulas: '数式',
      exportXlsx: 'Excel (.xlsx) を書き出し',
      exportCsv: 'CSV を書き出し',
      exporting: '処理中…',
      ready: '編集内容はこのページに保持されます',
      unsupportedTip:
        '画像とピボットテーブルには対応していません。本ツールで作成したグラフ・条件付き書式・データ検証は書き出しファイルに含まれません',
      err: err({
        EMPTY: 'ブックが空です',
        NOT_XLSX: '.xlsx ファイルのみ対応しています',
        UNSUPPORTED_LEGACY_XLS:
          '旧形式の .xls / .et には対応していません。.xlsx で保存し直してください',
        TOO_LARGE: 'ファイルが {{max}}MB の上限を超えています',
        IMPORT_FAILED: 'ファイルの解析に失敗しました',
        EXPORT_FAILED: 'Excel の書き出しに失敗しました',
        SNAPSHOT_FAILED: 'シートデータの取得に失敗しました',
        RUNTIME_FAILED: 'シートエンジンの起動に失敗しました',
      }),
    },
  },
};

const fr: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Nom du classeur',
      present: 'Présenter',
      exitPresent: 'Quitter (Échap)',
      presentLoading: 'Préparation du diaporama…',
      presentFailed: 'Échec de la préparation du diaporama',
      titlePlaceholder: 'Classeur sans titre',
      importHint: 'Déposez ou choisissez un fichier .xlsx / .csv pour importer le contenu',
      importXlsx: 'Importer une feuille (.xlsx / .csv)',
      newSheet: 'Nouveau classeur vide',
      addSheet: 'Ajouter une feuille',
      rename: 'Renommer',
      duplicate: 'Dupliquer la feuille',
      delete: 'Supprimer la feuille',
      hiddenSheet: 'masquée',
      sheets: 'Feuilles',
      rows: 'Lignes',
      columns: 'Colonnes',
      cells: 'Cellules',
      formulas: 'Formules',
      exportXlsx: 'Exporter Excel (.xlsx)',
      exportCsv: 'Exporter CSV',
      exporting: 'Traitement…',
      ready: 'Les modifications restent sur cette page',
      unsupportedTip:
        'Images et tableaux croisés dynamiques non pris en charge ; les graphiques, la mise en forme conditionnelle et la validation des données créés ici ne sont pas exportés',
      err: err({
        EMPTY: 'Le classeur est vide',
        NOT_XLSX: 'Seuls les fichiers .xlsx sont pris en charge',
        UNSUPPORTED_LEGACY_XLS:
          'Les anciens formats .xls / .et ne sont pas pris en charge, enregistrez en .xlsx',
        TOO_LARGE: 'Le fichier dépasse la limite de {{max}} Mo',
        IMPORT_FAILED: "Échec de l'analyse du fichier",
        EXPORT_FAILED: "Échec de l'export Excel",
        SNAPSHOT_FAILED: 'Lecture des données de la feuille impossible',
        RUNTIME_FAILED: 'Échec du démarrage du moteur de tableur',
      }),
    },
  },
};

const de: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Arbeitsmappenname',
      present: 'Präsentieren',
      exitPresent: 'Beenden (Esc)',
      presentLoading: 'Präsentationsansicht wird erstellt…',
      presentFailed: 'Präsentationsansicht fehlgeschlagen',
      titlePlaceholder: 'Unbenannte Arbeitsmappe',
      importHint: '.xlsx-/.csv-Datei hierher ziehen oder auswählen, um Inhalte zu importieren',
      importXlsx: 'Tabelle importieren (.xlsx / .csv)',
      newSheet: 'Neue leere Arbeitsmappe',
      addSheet: 'Blatt hinzufügen',
      rename: 'Umbenennen',
      duplicate: 'Blatt duplizieren',
      delete: 'Blatt löschen',
      hiddenSheet: 'ausgeblendet',
      sheets: 'Blätter',
      rows: 'Zeilen',
      columns: 'Spalten',
      cells: 'Zellen',
      formulas: 'Formeln',
      exportXlsx: 'Excel exportieren (.xlsx)',
      exportCsv: 'CSV exportieren',
      exporting: 'Wird verarbeitet…',
      ready: 'Änderungen bleiben auf dieser Seite',
      unsupportedTip:
        'Bilder und Pivot-Tabellen werden nicht unterstützt; hier erstellte Diagramme, bedingte Formatierungen und Datenvalidierungen werden nicht exportiert',
      err: err({
        EMPTY: 'Die Arbeitsmappe ist leer',
        NOT_XLSX: 'Nur .xlsx-Dateien werden unterstützt',
        UNSUPPORTED_LEGACY_XLS:
          'Alte .xls- / .et-Dateien werden nicht unterstützt, bitte als .xlsx speichern',
        TOO_LARGE: 'Die Datei überschreitet das Limit von {{max}} MB',
        IMPORT_FAILED: 'Datei konnte nicht gelesen werden',
        EXPORT_FAILED: 'Excel-Export fehlgeschlagen',
        SNAPSHOT_FAILED: 'Tabellendaten konnten nicht gelesen werden',
        RUNTIME_FAILED: 'Tabellen-Engine konnte nicht gestartet werden',
      }),
    },
  },
};

const it: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Nome della cartella di lavoro',
      present: 'Presenta',
      exitPresent: 'Esci (Esc)',
      presentLoading: 'Preparazione della presentazione…',
      presentFailed: 'Impossibile preparare la presentazione',
      titlePlaceholder: 'Cartella di lavoro senza titolo',
      importHint: 'Trascina o scegli un file .xlsx / .csv per importare il contenuto',
      importXlsx: 'Importa foglio (.xlsx / .csv)',
      newSheet: 'Nuova cartella vuota',
      addSheet: 'Aggiungi foglio',
      rename: 'Rinomina',
      duplicate: 'Duplica foglio',
      delete: 'Elimina foglio',
      hiddenSheet: 'nascosto',
      sheets: 'Fogli',
      rows: 'Righe',
      columns: 'Colonne',
      cells: 'Celle',
      formulas: 'Formule',
      exportXlsx: 'Esporta Excel (.xlsx)',
      exportCsv: 'Esporta CSV',
      exporting: 'Elaborazione…',
      ready: 'Le modifiche restano in questa pagina',
      unsupportedTip:
        'Immagini e tabelle pivot non sono supportati; grafici, formattazione condizionale e convalida dati creati qui non vengono esportati',
      err: err({
        EMPTY: 'La cartella di lavoro è vuota',
        NOT_XLSX: 'Sono supportati solo i file .xlsx',
        UNSUPPORTED_LEGACY_XLS:
          'I formati .xls / .et precedenti non sono supportati, salva come .xlsx',
        TOO_LARGE: 'Il file supera il limite di {{max}} MB',
        IMPORT_FAILED: 'Analisi del file non riuscita',
        EXPORT_FAILED: 'Esportazione Excel non riuscita',
        SNAPSHOT_FAILED: 'Lettura dei dati del foglio non riuscita',
        RUNTIME_FAILED: 'Avvio del motore del foglio non riuscito',
      }),
    },
  },
};

const es: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Nombre del libro',
      present: 'Presentar',
      exitPresent: 'Salir (Esc)',
      presentLoading: 'Preparando la presentación…',
      presentFailed: 'No se pudo preparar la presentación',
      titlePlaceholder: 'Libro sin título',
      importHint: 'Arrastra o elige un archivo .xlsx / .csv para importar el contenido',
      importXlsx: 'Importar hoja (.xlsx / .csv)',
      newSheet: 'Nuevo libro en blanco',
      addSheet: 'Añadir hoja',
      rename: 'Renombrar',
      duplicate: 'Duplicar hoja',
      delete: 'Eliminar hoja',
      hiddenSheet: 'oculta',
      sheets: 'Hojas',
      rows: 'Filas',
      columns: 'Columnas',
      cells: 'Celdas',
      formulas: 'Fórmulas',
      exportXlsx: 'Exportar Excel (.xlsx)',
      exportCsv: 'Exportar CSV',
      exporting: 'Procesando…',
      ready: 'Los cambios se mantienen en esta página',
      unsupportedTip:
        'No se admiten imágenes ni tablas dinámicas; los gráficos, el formato condicional y la validación de datos creados aquí no se exportan',
      err: err({
        EMPTY: 'El libro está vacío',
        NOT_XLSX: 'Solo se admiten archivos .xlsx',
        UNSUPPORTED_LEGACY_XLS:
          'Los formatos .xls / .et antiguos no son compatibles, guarda como .xlsx',
        TOO_LARGE: 'El archivo supera el límite de {{max}} MB',
        IMPORT_FAILED: 'No se pudo analizar el archivo',
        EXPORT_FAILED: 'La exportación a Excel falló',
        SNAPSHOT_FAILED: 'No se pudieron leer los datos de la hoja',
        RUNTIME_FAILED: 'No se pudo iniciar el motor de hojas de cálculo',
      }),
    },
  },
};

const pt: ResourceTree = {
  tools: {
    sheet: {
      docTitle: 'Nome do livro',
      present: 'Apresentar',
      exitPresent: 'Sair (Esc)',
      presentLoading: 'A preparar a apresentação…',
      presentFailed: 'Falha ao preparar a apresentação',
      titlePlaceholder: 'Livro sem título',
      importHint: 'Arraste ou escolha um ficheiro .xlsx / .csv para importar o conteúdo',
      importXlsx: 'Importar planilha (.xlsx / .csv)',
      newSheet: 'Novo livro em branco',
      addSheet: 'Adicionar folha',
      rename: 'Renomear',
      duplicate: 'Duplicar folha',
      delete: 'Eliminar folha',
      hiddenSheet: 'oculta',
      sheets: 'Folhas',
      rows: 'Linhas',
      columns: 'Colunas',
      cells: 'Células',
      formulas: 'Fórmulas',
      exportXlsx: 'Exportar Excel (.xlsx)',
      exportCsv: 'Exportar CSV',
      exporting: 'A processar…',
      ready: 'As alterações permanecem nesta página',
      unsupportedTip:
        'Imagens e tabelas dinâmicas não são suportados; gráficos, formatação condicional e validação de dados criados aqui não são exportados',
      err: err({
        EMPTY: 'O livro está vazio',
        NOT_XLSX: 'Apenas são suportados ficheiros .xlsx',
        UNSUPPORTED_LEGACY_XLS:
          'Os formatos antigos .xls / .et não são suportados, guarde como .xlsx',
        TOO_LARGE: 'O ficheiro excede o limite de {{max}} MB',
        IMPORT_FAILED: 'Falha ao analisar o ficheiro',
        EXPORT_FAILED: 'Falha ao exportar para Excel',
        SNAPSHOT_FAILED: 'Falha ao ler os dados da folha',
        RUNTIME_FAILED: 'Falha ao iniciar o motor da folha de cálculo',
      }),
    },
  },
};

/** 语言代码 → 资源树，键与 i18next 的 Lang 保持一致 */
export const spreadsheetStrings: Record<string, ResourceTree> = {
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

/** 把本工具文案合并进 i18next（工具懒加载时调用，键路径 tools.sheet.*） */
export function registerSpreadsheetStrings(instance: {
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: ResourceTree,
    deep: boolean,
    overwrite: boolean,
  ) => void;
}): void {
  for (const [lng, resources] of Object.entries(spreadsheetStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
