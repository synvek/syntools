/**
 * 「形状」交互层新增文案（下拉形状库 / 拖拽绘制 / 形状格式栏）。
 *
 * 形状的属性文案（填充、轮廓、图层…）早就在 `strings.ts` 的 9 个语言块里，这里只补
 * 本轮新加的三条，由 `strings.ts` 的 `EXTRA_STRINGS` 合并。
 */
export const shapeUiStrings: Record<string, Record<string, string>> = {
  zh: {
    shapeDrawHint: '选一个形状后，在页面上拖拽即可绘制；单击插入默认大小',
    shapeQuickFormat: '形状格式',
    shapeMoreStyles: '更多样式',
  },
  en: {
    shapeDrawHint:
      'Pick a shape, then drag on the page to draw it; click to insert at default size',
    shapeQuickFormat: 'Shape format',
    shapeMoreStyles: 'More styles',
  },
  'zh-TW': {
    shapeDrawHint: '選一個形狀後，在頁面上拖曳即可繪製；按一下插入預設大小',
    shapeQuickFormat: '圖案格式',
    shapeMoreStyles: '更多樣式',
  },
  ja: {
    shapeDrawHint:
      '図形を選んでページ上でドラッグすると描画できます。クリックすると既定のサイズで挿入します',
    shapeQuickFormat: '図形の書式',
    shapeMoreStyles: 'その他のスタイル',
  },
  fr: {
    shapeDrawHint:
      'Choisissez une forme puis faites glisser sur la page pour la dessiner ; cliquez pour insérer à la taille par défaut',
    shapeQuickFormat: 'Format de la forme',
    shapeMoreStyles: 'Autres styles',
  },
  de: {
    shapeDrawHint:
      'Form auswählen und auf der Seite ziehen, um sie zu zeichnen; Klicken fügt sie in Standardgröße ein',
    shapeQuickFormat: 'Formformat',
    shapeMoreStyles: 'Weitere Formate',
  },
  it: {
    shapeDrawHint:
      'Scegli una forma e trascina sulla pagina per disegnarla; fai clic per inserirla nella dimensione predefinita',
    shapeQuickFormat: 'Formato forma',
    shapeMoreStyles: 'Altri stili',
  },
  es: {
    shapeDrawHint:
      'Elige una forma y arrastra sobre la página para dibujarla; haz clic para insertarla con el tamaño predeterminado',
    shapeQuickFormat: 'Formato de forma',
    shapeMoreStyles: 'Más estilos',
  },
  pt: {
    shapeDrawHint:
      'Escolha uma forma e arraste na página para desenhá-la; clique para inserir no tamanho padrão',
    shapeQuickFormat: 'Formato da forma',
    shapeMoreStyles: 'Mais estilos',
  },
};
