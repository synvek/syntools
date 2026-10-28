import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';
import { columnIndexToName, hexToArgb } from './core';

/**
 * Conditional formatting / data validation export (P1-3).
 *
 * Rules created inside the editor live in the workbook snapshot's `resources`, grouped by
 * plugin → unitId → sheetId (that is how Univer serializes both models). They are converted to
 * exceljs shapes here and written during export, so "created in the app" and "imported from a
 * file" take the same path out.
 *
 * Anything exceljs/OOXML cannot express is counted instead of dropped silently; the export
 * fidelity report turns those counts into warnings.
 */

const CF_RESOURCE = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';
const DV_RESOURCE = 'SHEET_DATA_VALIDATION_PLUGIN';
/** exceljs writes data validation per cell, so a huge range would explode the file */
const MAX_DV_CELLS = 2000;

const ICON_SETS = new Set([
  '3Arrows',
  '3ArrowsGray',
  '3Flags',
  '3TrafficLights1',
  '3TrafficLights2',
  '3Signs',
  '3Symbols',
  '3Symbols2',
  '4Arrows',
  '4ArrowsGray',
  '4RedToBlack',
  '4Rating',
  '4TrafficLights',
  '5Arrows',
  '5ArrowsGray',
  '5Rating',
  '5Quarters',
]);

type Json = Record<string, unknown>;

interface CellRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface EditorValidationRules {
  conditionalFormattings: ConditionalFormattingOptions[];
  /** Cell address → data validation (exceljs shape) */
  dataValidations: Record<string, DataValidation>;
  /** Rules that OOXML/exceljs cannot represent; surfaced by the fidelity report */
  unsupportedConditionalFormattings: number;
  unsupportedDataValidations: number;
}

const EMPTY_RULES: Json[] = [];

const EMPTY: EditorValidationRules = {
  conditionalFormattings: [],
  dataValidations: {},
  unsupportedConditionalFormattings: 0,
  unsupportedDataValidations: 0,
};

function asRecord(value: unknown): Json | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

/**
 * Rules for one sheet: `resources[plugin][unitId][sheetId]` (the documented shape), with a flat
 * `resources[plugin][sheetId]` fallback so a future Univer layout doesn't silently drop data.
 */
function sheetRules(snapshot: object | null | undefined, plugin: string, sheetId: string): Json[] {
  const resources = asRecord(asRecord(snapshot)?.resources);
  const node = resources ? asRecord(resources[plugin]) : null;
  if (!node) return EMPTY_RULES;
  const direct = node[sheetId];
  if (Array.isArray(direct)) return direct.filter((item): item is Json => Boolean(asRecord(item)));
  for (const unit of Object.values(node)) {
    const subUnits = asRecord(unit);
    const rules = subUnits?.[sheetId];
    if (Array.isArray(rules)) {
      return rules.filter((item): item is Json => Boolean(asRecord(item)));
    }
  }
  return EMPTY_RULES;
}

/** 0-based inclusive range → "A1" / "A1:C3" (no sheet prefix: that is what `sqref` needs) */
export function rangeToA1(range: CellRange): string {
  const start = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
  const end = `${columnIndexToName(range.endColumn)}${range.endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
}

function toRange(value: unknown): CellRange | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const numbers = ['startRow', 'startColumn', 'endRow', 'endColumn'].map((key) => Number(raw[key]));
  if (numbers.some((item) => !Number.isFinite(item) || item < 0)) return null;
  return {
    startRow: Math.min(numbers[0], numbers[2]),
    endRow: Math.max(numbers[0], numbers[2]),
    startColumn: Math.min(numbers[1], numbers[3]),
    endColumn: Math.max(numbers[1], numbers[3]),
  };
}

/** Univer colour style ({ rgb: '#FF0000' }) → ARGB for exceljs */
function styleColor(value: unknown): string | undefined {
  const color = asRecord(value);
  const rgb = color?.rgb;
  return typeof rgb === 'string' ? hexToArgb(rgb) : undefined;
}

/** Univer `IStyleBase` → exceljs differential style (dxf) */
function toDxfStyle(style: unknown): Record<string, unknown> | undefined {
  const source = asRecord(style);
  if (!source) return undefined;
  const result: Record<string, unknown> = {};
  const fill = styleColor(source.bg);
  if (fill) {
    result.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  }
  const font: Record<string, unknown> = {};
  const color = styleColor(source.cl);
  if (color) font.color = { argb: color };
  if (source.bl) font.bold = true;
  if (source.it) font.italic = true;
  if (source.st) font.strike = true;
  if (source.ul) font.underline = true;
  if (Object.keys(font).length > 0) result.font = font;
  return Object.keys(result).length > 0 ? result : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Univer CF value config → exceljs cfvo */
function toCfvo(value: unknown): { type: string; val?: number } | null {
  const config = asRecord(value);
  if (!config) return null;
  switch (config.type) {
    case 'min':
      return { type: 'min' };
    case 'max':
      return { type: 'max' };
    case 'num':
    case 'percent':
    case 'percentile': {
      const val = numberValue(config.value);
      return val === undefined ? null : { type: config.type as string, val };
    }
    default:
      // 'formula' thresholds have no exceljs equivalent
      return null;
  }
}

function cellIsRule(rule: Json, priority: number): Json | null {
  const operator = typeof rule.operator === 'string' ? rule.operator : 'greaterThan';
  const value = rule.value;
  const formulae = Array.isArray(value)
    ? value.map((item) => String(item))
    : value === undefined || value === null || value === ''
      ? []
      : [String(value)];
  if (formulae.length === 0) return null;
  return { priority, type: 'cellIs', operator, formulae, style: toDxfStyle(rule.style) };
}

const TEXT_RULES = new Set([
  'containsText',
  'notContainsText',
  'beginsWith',
  'endsWith',
  'containsBlanks',
  'notContainsBlanks',
  'containsErrors',
  'notContainsErrors',
]);

function textRule(rule: Json, priority: number): Json | null {
  const operator = typeof rule.operator === 'string' ? rule.operator : 'containsText';
  if (!TEXT_RULES.has(operator)) return null;
  const text = typeof rule.value === 'string' ? rule.value : '';
  return {
    priority,
    type: operator,
    operator,
    ...(text ? { text } : {}),
    style: toDxfStyle(rule.style),
  };
}

/** One Univer CF config → one exceljs rule (null when unsupported) */
function toExcelRule(rule: Json, priority: number): Json | null {
  switch (rule.type) {
    case 'colorScale': {
      const config = Array.isArray(rule.config) ? rule.config : [];
      const cfvo = config.map((item) => toCfvo(asRecord(item)?.value));
      const color = config.map((item) => {
        const argb = hexToArgb(
          typeof asRecord(item)?.color === 'string' ? (asRecord(item)?.color as string) : undefined,
        );
        return { argb: argb ?? 'FF000000' };
      });
      if (cfvo.length < 2 || cfvo.some((item) => !item) || color.length !== cfvo.length)
        return null;
      return { priority, type: 'colorScale', cfvo, color };
    }
    case 'dataBar': {
      const config = asRecord(rule.config);
      const min = toCfvo(config?.min);
      const max = toCfvo(config?.max);
      if (!min || !max) return null;
      const argb = hexToArgb(
        typeof config?.positiveColor === 'string' ? (config.positiveColor as string) : undefined,
      );
      return {
        priority,
        type: 'dataBar',
        cfvo: [min, max],
        ...(argb ? { color: { argb } } : {}),
        gradient: config?.isGradient !== false,
        showValue: rule.isShowValue !== false,
      };
    }
    case 'iconSet': {
      const config = Array.isArray(rule.config) ? rule.config : [];
      const iconSet = asRecord(config[0])?.iconType;
      if (typeof iconSet !== 'string' || !ICON_SETS.has(iconSet)) return null;
      const cfvo = config.map((item) => toCfvo(asRecord(item)?.value));
      if (cfvo.some((item) => !item)) return null;
      return {
        priority,
        type: 'iconSet',
        iconSet,
        cfvo,
        showValue: rule.isShowValue !== false,
      };
    }
    case 'highlightCell': {
      const subType = rule.subType;
      if (subType === 'number') return cellIsRule(rule, priority);
      if (subType === 'text') return textRule(rule, priority);
      if (subType === 'formula') {
        const formula = typeof rule.value === 'string' ? rule.value.replace(/^=/, '') : '';
        if (!formula) return null;
        return { priority, type: 'expression', formulae: [formula], style: toDxfStyle(rule.style) };
      }
      if (subType === 'rank') {
        return {
          priority,
          type: 'top10',
          rank: numberValue(rule.value) ?? 10,
          percent: rule.isPercent === true,
          bottom: rule.isBottom === true,
          style: toDxfStyle(rule.style),
        };
      }
      if (subType === 'average') {
        const less = typeof rule.operator === 'string' && rule.operator.startsWith('lessThan');
        return {
          priority,
          type: 'aboveAverage',
          aboveAverage: !less,
          style: toDxfStyle(rule.style),
        };
      }
      if (subType === 'timePeriod' && typeof rule.operator === 'string') {
        return {
          priority,
          type: 'timePeriod',
          timePeriod: rule.operator,
          style: toDxfStyle(rule.style),
        };
      }
      // unique/duplicate values have no exceljs (or classic OOXML cfRule) equivalent
      return null;
    }
    default:
      return null;
  }
}

function toConditionalFormattings(rules: Json[]): {
  formats: ConditionalFormattingOptions[];
  unsupported: number;
} {
  const formats: ConditionalFormattingOptions[] = [];
  let unsupported = 0;
  let priority = 0;
  for (const entry of rules) {
    const config = asRecord(entry.rule);
    if (!config) {
      unsupported += 1;
      continue;
    }
    const ranges = Array.isArray(entry.ranges) ? entry.ranges : [];
    priority += 1;
    const rule = toExcelRule(config, priority);
    if (!rule || ranges.length === 0) {
      unsupported += 1;
      continue;
    }
    for (const raw of ranges) {
      const range = toRange(raw);
      if (!range) {
        unsupported += 1;
        continue;
      }
      formats.push({ ref: rangeToA1(range), rules: [rule as never] });
    }
  }
  return { formats, unsupported };
}

/** Univer DV type → exceljs/OOXML type; null means "not representable" */
function dvType(type: unknown): DataValidation['type'] | null | 'skip' {
  switch (type) {
    case 'list':
    case 'listMultiple':
      return 'list';
    case 'whole':
      return 'whole';
    case 'decimal':
      return 'decimal';
    case 'date':
      return 'date';
    case 'textLength':
      return 'textLength';
    case 'custom':
      return 'custom';
    case 'any':
    case 'none':
      return 'skip';
    default:
      // time / checkbox
      return null;
  }
}

/** A literal list must be quoted for Excel; ranges and formulas stay untouched */
function listFormula(formula: unknown): string | undefined {
  if (typeof formula !== 'string') return undefined;
  const value = formula.trim();
  if (!value) return undefined;
  if (value.startsWith('"') && value.endsWith('"')) return value;
  if (
    /^\$?[A-Za-z]+\$?\d+(:\$?[A-Za-z]+\$?\d+)?$/.test(value) ||
    /^[A-Za-z_][\w.]*\(/.test(value)
  ) {
    return value.replace(/^=/, '');
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function dvErrorStyle(style: unknown): DataValidation['errorStyle'] | undefined {
  if (style === 1 || style === '1' || style === 'stop') return 'stop';
  if (style === 2 || style === '2' || style === 'warning') return 'warning';
  if (style === 0 || style === '0' || style === 'info' || style === 'information') {
    return 'information';
  }
  return undefined;
}

function toDataValidation(rule: Json): DataValidation | null {
  const type = dvType(rule.type);
  if (type === null || type === 'skip') return null;
  const formulae: string[] = [];
  const first =
    type === 'list'
      ? listFormula(rule.formula1)
      : typeof rule.formula1 === 'string'
        ? rule.formula1.replace(/^=/, '')
        : undefined;
  const second =
    typeof rule.formula2 === 'string' && rule.formula2.trim()
      ? rule.formula2.replace(/^=/, '')
      : undefined;
  if (first) formulae.push(first);
  if (second) formulae.push(second);
  if (formulae.length === 0 && type !== 'custom') return null;
  return {
    type,
    ...(rule.allowBlank === true ? { allowBlank: true } : {}),
    ...(typeof rule.operator === 'string'
      ? { operator: rule.operator as DataValidation['operator'] }
      : {}),
    formulae,
    ...(rule.showErrorMessage === true ? { showErrorMessage: true } : {}),
    ...(rule.showInputMessage === true ? { showInputMessage: true } : {}),
    ...(dvErrorStyle(rule.errorStyle) ? { errorStyle: dvErrorStyle(rule.errorStyle) } : {}),
    ...(typeof rule.errorTitle === 'string' ? { errorTitle: rule.errorTitle } : {}),
    ...(typeof rule.error === 'string' ? { error: rule.error } : {}),
    ...(typeof rule.promptTitle === 'string' ? { promptTitle: rule.promptTitle } : {}),
    ...(typeof rule.prompt === 'string' ? { prompt: rule.prompt } : {}),
  };
}

function toDataValidations(rules: Json[]): {
  validations: Record<string, DataValidation>;
  unsupported: number;
} {
  const validations: Record<string, DataValidation> = {};
  let unsupported = 0;
  let cells = 0;
  for (const rule of rules) {
    const validation = toDataValidation(rule);
    const ranges = Array.isArray(rule.ranges) ? rule.ranges.map(toRange) : [];
    if (!validation || ranges.length === 0 || ranges.some((range) => !range)) {
      unsupported += 1;
      continue;
    }
    let overflow = false;
    for (const range of ranges) {
      if (!range) continue;
      const width = range.endColumn - range.startColumn + 1;
      const height = range.endRow - range.startRow + 1;
      cells += width * height;
      if (cells > MAX_DV_CELLS) {
        overflow = true;
        break;
      }
      for (let row = range.startRow; row <= range.endRow; row += 1) {
        for (let column = range.startColumn; column <= range.endColumn; column += 1) {
          validations[`${columnIndexToName(column)}${row + 1}`] = { ...validation };
        }
      }
    }
    if (overflow) unsupported += 1;
  }
  return { validations, unsupported };
}

/**
 * Collect the editor's CF/DV rules for one sheet, converted to exceljs shapes.
 * Unsupported rules are counted so the caller can report them instead of dropping them.
 */
export function collectEditorValidation(
  snapshot: object | null | undefined,
  sheetId: string,
): EditorValidationRules {
  const cf = toConditionalFormattings(sheetRules(snapshot, CF_RESOURCE, sheetId));
  const dv = toDataValidations(sheetRules(snapshot, DV_RESOURCE, sheetId));
  if (
    cf.formats.length === 0 &&
    Object.keys(dv.validations).length === 0 &&
    cf.unsupported === 0 &&
    dv.unsupported === 0
  ) {
    return EMPTY;
  }
  return {
    conditionalFormattings: cf.formats,
    dataValidations: dv.validations,
    unsupportedConditionalFormattings: cf.unsupported,
    unsupportedDataValidations: dv.unsupported,
  };
}

/** Snapshot-wide count of editor rules that will not reach the file */
export function countUnsupportedValidation(snapshot: { sheetOrder?: string[] }): {
  conditionalFormattings: number;
  dataValidations: number;
} {
  let conditionalFormattings = 0;
  let dataValidations = 0;
  for (const sheetId of snapshot.sheetOrder ?? []) {
    const rules = collectEditorValidation(snapshot, sheetId);
    conditionalFormattings += rules.unsupportedConditionalFormattings;
    dataValidations += rules.unsupportedDataValidations;
  }
  return { conditionalFormattings, dataValidations };
}
