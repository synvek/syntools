/**
 * Copy for structured-import (IR) fidelity warnings (implementation plan P0-2.5).
 *
 * Incremental block merged into `tools.richText.*` by `strings.ts` — the nine main language
 * blocks stay untouched, and `strings.test.ts` enforces an identical key set for every language.
 * Three grouped keys cover every `IrLoss` code; `fidelity.ts` aggregates raw codes into them.
 */

type StringTree = { [key: string]: string | StringTree };

export const irLossStrings: Record<string, StringTree> = {
  zh: {
    lossIrStructure:
      '结构化导入：{{count}} 项结构（图片/形状/分节/书签）已按锚点保留，尚未全部回填',
    lossIrReview: '结构化导入：{{count}} 项修订、批注或说明暂未回填',
    lossIrFields: '结构化导入：{{count}} 项域或公式暂未回填',
  },
  en: {
    lossIrStructure:
      'Structured import: {{count}} structural items (images/shapes/sections/bookmarks) were anchored but not fully restored',
    lossIrReview: 'Structured import: {{count}} revisions, comments or notes were not restored',
    lossIrFields: 'Structured import: {{count}} fields or equations were not restored',
  },
  'zh-TW': {
    lossIrStructure:
      '結構化匯入：{{count}} 項結構（圖片/圖案/分節/書籤）已按錨點保留，尚未全部回填',
    lossIrReview: '結構化匯入：{{count}} 項修訂、註解或註腳尚未回填',
    lossIrFields: '結構化匯入：{{count}} 項欄位或公式尚未回填',
  },
  ja: {
    lossIrStructure:
      '構造化インポート：{{count}} 件の構造（画像/図形/セクション/ブックマーク）をアンカーで保持しましたが、完全には復元されていません',
    lossIrReview: '構造化インポート：{{count}} 件の変更履歴・コメント・注釈は復元されていません',
    lossIrFields: '構造化インポート：{{count}} 件のフィールドまたは数式は復元されていません',
  },
  fr: {
    lossIrStructure:
      'Import structuré : {{count}} éléments structurels (images/formes/sections/signets) ancrés mais non entièrement restaurés',
    lossIrReview: 'Import structuré : {{count}} révisions, commentaires ou notes non restaurés',
    lossIrFields: 'Import structuré : {{count}} champs ou équations non restaurés',
  },
  de: {
    lossIrStructure:
      'Strukturierter Import: {{count}} Strukturelemente (Bilder/Formen/Abschnitte/Lesezeichen) verankert, aber nicht vollständig wiederhergestellt',
    lossIrReview:
      'Strukturierter Import: {{count}} Überarbeitungen, Kommentare oder Notizen nicht wiederhergestellt',
    lossIrFields: 'Strukturierter Import: {{count}} Felder oder Formeln nicht wiederhergestellt',
  },
  es: {
    lossIrStructure:
      'Importación estructurada: {{count}} elementos estructurales (imágenes/formas/secciones/marcadores) anclados pero no restaurados por completo',
    lossIrReview:
      'Importación estructurada: {{count}} revisiones, comentarios o notas no restaurados',
    lossIrFields: 'Importación estructurada: {{count}} campos o ecuaciones no restaurados',
  },
  pt: {
    lossIrStructure:
      'Importação estruturada: {{count}} itens estruturais (imagens/formas/seções/marcadores) ancorados, mas não totalmente restaurados',
    lossIrReview:
      'Importação estruturada: {{count}} revisões, comentários ou notas não restaurados',
    lossIrFields: 'Importação estruturada: {{count}} campos ou equações não restaurados',
  },
  it: {
    lossIrStructure:
      'Import strutturato: {{count}} elementi strutturali (immagini/forme/sezioni/segnalibri) ancorati ma non ripristinati completamente',
    lossIrReview: 'Import strutturato: {{count}} revisioni, commenti o note non ripristinati',
    lossIrFields: 'Import strutturato: {{count}} campi o equazioni non ripristinati',
  },
};
