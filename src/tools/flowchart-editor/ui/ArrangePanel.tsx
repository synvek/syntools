import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import {
  applyUniformSize,
  alignSelectedToScope,
  distributeSelectedInScope,
  groupSelected,
  layerOp,
  snapSelectedToGrid,
  ungroupSelected,
  type ArrangeScope,
  type DistributeMode,
} from '../flowOps';
import type { AlignMode, LayerOp } from '../ops';

const ALIGN_MODES: Array<{ mode: AlignMode; labelKey: string; glyph: string }> = [
  { mode: 'left', labelKey: 'alignLeft', glyph: '⇤' },
  { mode: 'hcenter', labelKey: 'alignCenter', glyph: '↔' },
  { mode: 'right', labelKey: 'alignRight', glyph: '⇥' },
  { mode: 'top', labelKey: 'alignTop', glyph: '⇡' },
  { mode: 'vcenter', labelKey: 'alignMiddle', glyph: '↕' },
  { mode: 'bottom', labelKey: 'alignBottom', glyph: '⇣' },
];

const LAYER_OPS: Array<{ op: LayerOp; labelKey: string; glyph: string }> = [
  { op: 'front', labelKey: 'layerFront', glyph: '⤒' },
  { op: 'forward', labelKey: 'layerForward', glyph: '↑' },
  { op: 'backward', labelKey: 'layerBackward', glyph: '↓' },
  { op: 'back', labelKey: 'layerBack', glyph: '⤓' },
];

const SCOPES: Array<{ scope: ArrangeScope; labelKey: string }> = [
  { scope: 'selection', labelKey: 'scopeSelection' },
  { scope: 'canvas', labelKey: 'scopeCanvas' },
  { scope: 'page', labelKey: 'scopePage' },
];

const baseBtn =
  'flex h-7 items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 text-[12px] text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:border-blue-500';

const sectionTitle =
  'text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

/**
 * 排列工具箱：对齐（含对齐到画布 / 页面）、分布（等间距 / 贴边）、统一尺寸、
 * 吸附网格、层级与编组。所有操作复用 `flowOps`，单选即可对齐，分布需要多选。
 */
export function ArrangePanel() {
  const { t } = useTranslation();
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const [scope, setScope] = useState<ArrangeScope>('selection');
  const [distMode, setDistMode] = useState<DistributeMode>('spacing');

  const count = selectedNodes.length;
  const noSelection = count === 0;
  const canDistribute = distMode === 'spacing' ? count >= 3 : count >= 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={sectionTitle}>{t('tools.flowchart.arrangeScope')}</span>
        <div className="flex gap-1">
          {SCOPES.map((item) => (
            <button
              key={item.scope}
              type="button"
              data-testid={`arrange-scope-${item.scope}`}
              aria-pressed={scope === item.scope}
              onClick={() => setScope(item.scope)}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] transition-colors ${
                scope === item.scope
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t(`tools.flowchart.${item.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionTitle}>{t('tools.flowchart.align')}</span>
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              data-testid={`arrange-align-${item.mode}`}
              title={t(`tools.flowchart.${item.labelKey}`)}
              aria-label={t(`tools.flowchart.${item.labelKey}`)}
              disabled={noSelection}
              onClick={() => alignSelectedToScope(item.mode, scope)}
              className={baseBtn}
            >
              <span aria-hidden="true">{item.glyph}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionTitle}>{t('tools.flowchart.distributeH')}</span>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="arrange-dist-mode-spacing"
            aria-pressed={distMode === 'spacing'}
            onClick={() => setDistMode('spacing')}
            className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] transition-colors ${
              distMode === 'spacing'
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t('tools.flowchart.distributeSpacing')}
          </button>
          <button
            type="button"
            data-testid="arrange-dist-mode-edges"
            aria-pressed={distMode === 'edges'}
            onClick={() => setDistMode('edges')}
            className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] transition-colors ${
              distMode === 'edges'
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t('tools.flowchart.distributeEdges')}
          </button>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="arrange-distribute-h"
            title={t('tools.flowchart.distributeH')}
            disabled={!canDistribute}
            onClick={() => distributeSelectedInScope('h', scope, distMode)}
            className={`${baseBtn} flex-1`}
          >
            ↔
          </button>
          <button
            type="button"
            data-testid="arrange-distribute-v"
            title={t('tools.flowchart.distributeV')}
            disabled={!canDistribute}
            onClick={() => distributeSelectedInScope('v', scope, distMode)}
            className={`${baseBtn} flex-1`}
          >
            ↕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionTitle}>{t('tools.flowchart.layerFront')}</span>
        <div className="grid grid-cols-4 gap-1">
          {LAYER_OPS.map((item) => (
            <button
              key={item.op}
              type="button"
              data-testid={`arrange-layer-${item.op}`}
              title={t(`tools.flowchart.${item.labelKey}`)}
              aria-label={t(`tools.flowchart.${item.labelKey}`)}
              disabled={noSelection}
              onClick={() => layerOp(item.op)}
              className={baseBtn}
            >
              <span aria-hidden="true">{item.glyph}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionTitle}>{t('tools.flowchart.uniformSize')}</span>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="arrange-uniform-size"
            disabled={count < 2}
            onClick={applyUniformSize}
            className={`${baseBtn} flex-1`}
          >
            {t('tools.flowchart.uniformSize')}
          </button>
          <button
            type="button"
            data-testid="arrange-snap-grid"
            disabled={noSelection}
            onClick={snapSelectedToGrid}
            className={`${baseBtn} flex-1`}
          >
            {t('tools.flowchart.snapSelectionToGrid')}
          </button>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="arrange-group"
            disabled={noSelection}
            onClick={groupSelected}
            className={`${baseBtn} flex-1`}
          >
            {t('tools.flowchart.group')}
          </button>
          <button
            type="button"
            data-testid="arrange-ungroup"
            disabled={noSelection}
            onClick={ungroupSelected}
            className={`${baseBtn} flex-1`}
          >
            {t('tools.flowchart.ungroup')}
          </button>
        </div>
      </div>
    </div>
  );
}
