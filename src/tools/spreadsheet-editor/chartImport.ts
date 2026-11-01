import { parseChartXml } from './chartXml';
import type { ChartType } from './charts';

/**
 * 图表回读（P2-S8）。
 *
 * 导入文件里的原生图表**不做语义重建**：它们作为原始 part 原样保留（`rawChartParts.ts`），
 * 导出时逐字节写回，所以在 Excel 里始终可编辑。这里做的是"读得懂"——解析每个 chart part 的类型，
 * 让导入后的界面能告诉用户"文件里有 N 个图表，其中柱状 2、散点 1"。
 *
 * 为什么不在导入时把它们变成可编辑的 `syntoolsCharts`：那会与原始 part 的写回路径重复，
 * 导出时同一张图会被写两次（一次来自 config、一次来自保留的 part）。真要支持"导入即编辑"，
 * 必须先做"从 drawing 里摘除 anchor + 关系 + part"的减法，风险远高于收益，留作后续。
 */

export interface ChartFileSummary {
  total: number;
  /** 类型 → 数量；只统计能识别的图表 */
  byType: Partial<Record<ChartType, number>>;
  /** 识别不出的 chart part 数量（例如股价图/曲面图） */
  unknown: number;
}

const CHART_PART = /^xl\/charts\/[^/]+\.xml$/;

/** base64 → 文本（浏览器与 jsdom 都有 atob；失败时返回 null，不让一次坏数据毁掉整个导入） */
function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** 统计保留的 chart part（`RawChartParts.parts` 的 path → base64 映射） */
export function summarizeChartParts(parts: Readonly<Record<string, string>>): ChartFileSummary {
  const summary: ChartFileSummary = { total: 0, byType: {}, unknown: 0 };
  for (const [path, content] of Object.entries(parts)) {
    if (!CHART_PART.test(path)) continue;
    summary.total += 1;
    const xml = decodeBase64(content);
    const parsed = xml ? parseChartXml(xml) : null;
    if (!parsed) {
      summary.unknown += 1;
      continue;
    }
    summary.byType[parsed.type] = (summary.byType[parsed.type] ?? 0) + 1;
  }
  return summary;
}

/** 给提示文案用：把统计结果压成"柱状 2 · 散点 1"这样的片段（类型名由调用方翻译） */
export function chartTypeBreakdown(
  summary: ChartFileSummary,
): { type: ChartType; count: number }[] {
  return (Object.entries(summary.byType) as [ChartType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}
