import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SELECTIVE_RANGES,
  curvePointsFrom,
  defaultBlackWhite,
  defaultChannelMixer,
  defaultColorBalance,
  defaultCurves,
  defaultLevels,
  defaultPhotoFilter,
  defaultReplaceColor,
  defaultSelectiveColor,
  defaultShadowsHighlights,
} from '../core';
import { createAdjustments } from '../model/factory';
import { Button, Field, PanelSection, Slider, ToggleChip } from './controls';
import { CurveEditor } from './CurveEditor';
import { usePhotoStore } from '../store';
import type {
  Adjustments,
  BlackWhiteParams,
  ColorBalanceParams,
  CurvePoint,
  SelectiveRange,
} from '../model/types';

const ROWS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'exposure', min: -100, max: 100 },
  { key: 'brightness', label: 'brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'saturation', min: -100, max: 100 },
  { key: 'temperature', label: 'temperature', min: -100, max: 100 },
  { key: 'hue', label: 'hue', min: -180, max: 180 },
  { key: 'sharpen', label: 'sharpen', min: 0, max: 100 },
];

const CB_TONES = ['shadows', 'midtones', 'highlights'] as const;
const CB_TONE_LABELS = ['cbShadows', 'cbMidtones', 'cbHighlights'];
const CB_AXIS_LABELS = ['cbCyanRed', 'cbMagentaGreen', 'cbYellowBlue'];

const BW_CHANNELS: { key: keyof BlackWhiteParams; label: string }[] = [
  { key: 'red', label: 'bwRed' },
  { key: 'yellow', label: 'bwYellow' },
  { key: 'green', label: 'bwGreen' },
  { key: 'cyan', label: 'bwCyan' },
  { key: 'blue', label: 'bwBlue' },
  { key: 'magenta', label: 'bwMagenta' },
];

const DEFAULT_GRADIENT = {
  stops: [
    { pos: 0, color: '#000000' },
    { pos: 1, color: '#FFFFFF' },
  ],
};

/** 通道混合器的三行输出（顺序即面板顺序） */
const CM_CHANNELS: { key: 'red' | 'green' | 'blue'; label: string }[] = [
  { key: 'red', label: 'chanRed' },
  { key: 'green', label: 'chanGreen' },
  { key: 'blue', label: 'chanBlue' },
];

/** 每一行的三个来源通道（复用 R/G/B 通道名） */
const CM_SOURCES = ['chanRed', 'chanGreen', 'chanBlue'];

/** 可选颜色面板里的 CMYK 四个通道（C/M/Y 复用黑白的通道文案） */
const SC_INKS: { index: number; label: string }[] = [
  { index: 0, label: 'bwCyan' },
  { index: 1, label: 'bwMagenta' },
  { index: 2, label: 'bwYellow' },
  { index: 3, label: 'scBlackInk' },
];

/**
 * 「更多调整」区块：五项均可独立启停，参数与 `render/adjustMore.ts` 一一对应。
 * 单独抽成组件是因为它自带较多局部状态（如可选颜色的当前色域）。
 */
function MoreAdjustments({
  value,
  setAdj,
}: {
  value: Adjustments;
  setAdj: (patch: Partial<Adjustments>, history?: boolean) => void;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<SelectiveRange>('reds');
  const photo = value.photoFilter;
  const mixer = value.channelMixer;
  const tone = value.shadowsHighlights;
  const selective = value.selectiveColor;
  const replace = value.replaceColor;

  return (
    <>
      {/* 照片滤镜 */}
      <ToggleChip
        label={t('tools.photo.adjPhotoFilter')}
        active={Boolean(photo)}
        onClick={() => setAdj({ photoFilter: photo ? null : defaultPhotoFilter() })}
      />
      {photo ? (
        <PanelSection>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('tools.photo.fxColor')}
            </span>
            <input
              type="color"
              aria-label={t('tools.photo.fxColor')}
              value={photo.color}
              onChange={(event) =>
                setAdj({ photoFilter: { ...photo, color: event.target.value.toUpperCase() } })
              }
              className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
            />
          </div>
          <Slider
            label={t('tools.photo.pfDensity')}
            value={photo.density}
            min={0}
            max={100}
            suffix="%"
            onChange={(next) => setAdj({ photoFilter: { ...photo, density: next } })}
          />
          <ToggleChip
            label={t('tools.photo.pfPreserve')}
            active={photo.preserveLuminosity}
            onClick={() =>
              setAdj({
                photoFilter: { ...photo, preserveLuminosity: !photo.preserveLuminosity },
              })
            }
          />
        </PanelSection>
      ) : null}

      {/* 通道混合器 */}
      <ToggleChip
        label={t('tools.photo.adjChannelMixer')}
        active={Boolean(mixer)}
        onClick={() => setAdj({ channelMixer: mixer ? null : defaultChannelMixer() })}
      />
      {mixer ? (
        <PanelSection>
          {CM_CHANNELS.map((channel) => {
            const row = mixer[channel.key];
            return (
              <div key={channel.key} className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t(`tools.photo.${channel.label}`)}
                </span>
                {CM_SOURCES.map((source, index) => (
                  <Slider
                    key={source}
                    label={t(`tools.photo.${source}`)}
                    value={row[index] ?? 0}
                    min={-200}
                    max={200}
                    suffix="%"
                    onChange={(next) =>
                      setAdj({
                        channelMixer: {
                          ...mixer,
                          [channel.key]: row.map((old, i) => (i === index ? next : old)),
                        },
                      })
                    }
                  />
                ))}
                <Slider
                  label={t('tools.photo.cmConstant')}
                  value={row[3] ?? 0}
                  min={-100}
                  max={100}
                  suffix="%"
                  onChange={(next) =>
                    setAdj({
                      channelMixer: {
                        ...mixer,
                        [channel.key]: [row[0] ?? 0, row[1] ?? 0, row[2] ?? 0, next],
                      },
                    })
                  }
                />
              </div>
            );
          })}
        </PanelSection>
      ) : null}

      {/* 阴影 / 高光 */}
      <ToggleChip
        label={t('tools.photo.adjShadowsHighlights')}
        active={Boolean(tone)}
        onClick={() => setAdj({ shadowsHighlights: tone ? null : defaultShadowsHighlights() })}
      />
      {tone ? (
        <PanelSection>
          <Slider
            label={t('tools.photo.shShadows')}
            value={tone.shadows}
            min={0}
            max={100}
            suffix="%"
            onChange={(next) => setAdj({ shadowsHighlights: { ...tone, shadows: next } })}
          />
          <Slider
            label={t('tools.photo.shHighlights')}
            value={tone.highlights}
            min={0}
            max={100}
            suffix="%"
            onChange={(next) => setAdj({ shadowsHighlights: { ...tone, highlights: next } })}
          />
        </PanelSection>
      ) : null}

      {/* 可选颜色 */}
      <ToggleChip
        label={t('tools.photo.adjSelectiveColor')}
        active={Boolean(selective)}
        onClick={() => setAdj({ selectiveColor: selective ? null : defaultSelectiveColor() })}
      />
      {selective ? (
        <PanelSection>
          <div className="flex flex-wrap gap-1">
            {SELECTIVE_RANGES.map((id) => (
              <ToggleChip
                key={id}
                label={t(`tools.photo.sc${id.charAt(0).toUpperCase()}${id.slice(1)}`)}
                active={range === id}
                onClick={() => setRange(id)}
              />
            ))}
          </div>
          {SC_INKS.map((ink) => {
            const row = selective.ranges[range] ?? [0, 0, 0, 0];
            return (
              <Slider
                key={ink.index}
                label={t(`tools.photo.${ink.label}`)}
                value={row[ink.index] ?? 0}
                min={-100}
                max={100}
                suffix="%"
                onChange={(next) =>
                  setAdj({
                    selectiveColor: {
                      ranges: {
                        ...selective.ranges,
                        [range]: row.map((old, i) => (i === ink.index ? next : old)),
                      },
                    },
                  })
                }
              />
            );
          })}
        </PanelSection>
      ) : null}

      {/* 替换颜色 */}
      <ToggleChip
        label={t('tools.photo.adjReplaceColor')}
        active={Boolean(replace)}
        onClick={() => setAdj({ replaceColor: replace ? null : defaultReplaceColor() })}
      />
      {replace ? (
        <PanelSection>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('tools.photo.fxColor')}
            </span>
            <input
              type="color"
              aria-label={t('tools.photo.fxColor')}
              value={replace.color}
              onChange={(event) =>
                setAdj({ replaceColor: { ...replace, color: event.target.value.toUpperCase() } })
              }
              className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
            />
          </div>
          <Slider
            label={t('tools.photo.rcFuzziness')}
            value={replace.fuzziness}
            min={1}
            max={200}
            onChange={(next) => setAdj({ replaceColor: { ...replace, fuzziness: next } })}
          />
          <Slider
            label={t('tools.photo.hue')}
            value={replace.hue}
            min={-180}
            max={180}
            suffix="°"
            onChange={(next) => setAdj({ replaceColor: { ...replace, hue: next } })}
          />
          <Slider
            label={t('tools.photo.saturation')}
            value={replace.saturation}
            min={-100}
            max={100}
            suffix="%"
            onChange={(next) => setAdj({ replaceColor: { ...replace, saturation: next } })}
          />
          <Slider
            label={t('tools.photo.rcLightness')}
            value={replace.lightness}
            min={-100}
            max={100}
            suffix="%"
            onChange={(next) => setAdj({ replaceColor: { ...replace, lightness: next } })}
          />
        </PanelSection>
      ) : null}
    </>
  );
}

/**
 * 调整面板：非破坏性参数，写回图层后由 `render/filters.ts` 统一烘焙，
 * 预览与导出共用同一条管线（所见即所得）。
 *
 * 分两层：
 * - 基础 7 项滑杆（与既有工程完全兼容）；
 * - 扩展调整（色阶 / 曲线 / 色彩平衡 / 黑白 / 阈值 / 渐变映射 / 去色），各自可独立启停。
 */
export function AdjustPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const commit = usePhotoStore((s) => s.commit);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  // 双模式：既可调「位图图层自带的调整」，也可调「调整图层」（后者作用于其下方全部内容）
  const adjustable =
    layer && (layer.kind === 'raster' || layer.kind === 'adjustment') ? layer : null;
  if (!adjustable) {
    return (
      <div className="flex flex-col gap-2">
        <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('tools.photo.noLayer')}
        </p>
      </div>
    );
  }

  const value = adjustable.adjustments;
  const setAdj = (patch: Partial<Adjustments>, history = false) =>
    patchActive({ adjustments: { ...value, ...patch } } as never, history);

  const levels = value.levels;
  const curves = value.curves;
  const balance = value.colorBalance;
  const bw = value.blackWhite;
  const gradient = value.gradientMap;
  const threshold = value.threshold;

  const patchBalance = (tone: (typeof CB_TONES)[number], axis: number, next: number) => {
    if (!balance) return;
    const current = balance[tone];
    const updated: ColorBalanceParams = {
      ...balance,
      [tone]: current.map((old, index) => (index === axis ? next : old)),
    };
    setAdj({ colorBalance: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => (
        <Slider
          key={row.key}
          label={t(`tools.photo.${row.label}`)}
          value={value[row.key] as number}
          min={row.min}
          max={row.max}
          onChange={(next) => setAdj({ [row.key]: next } as Partial<Adjustments>)}
        />
      ))}

      {/* 色阶 */}
      <ToggleChip
        label={t('tools.photo.adjLevels')}
        active={Boolean(levels)}
        onClick={() => setAdj({ levels: levels ? null : defaultLevels() })}
      />
      {levels ? (
        <PanelSection>
          <Slider
            label={t('tools.photo.lvInBlack')}
            value={levels.inBlack}
            min={0}
            max={254}
            onChange={(v) => setAdj({ levels: { ...levels, inBlack: v } })}
          />
          <Slider
            label={t('tools.photo.lvInWhite')}
            value={levels.inWhite}
            min={1}
            max={255}
            onChange={(v) => setAdj({ levels: { ...levels, inWhite: v } })}
          />
          <Slider
            label={t('tools.photo.lvGamma')}
            value={Math.round(levels.gamma * 100)}
            min={10}
            max={300}
            onChange={(v) => setAdj({ levels: { ...levels, gamma: v / 100 } })}
          />
          <Slider
            label={t('tools.photo.lvOutBlack')}
            value={levels.outBlack}
            min={0}
            max={255}
            onChange={(v) => setAdj({ levels: { ...levels, outBlack: v } })}
          />
          <Slider
            label={t('tools.photo.lvOutWhite')}
            value={levels.outWhite}
            min={0}
            max={255}
            onChange={(v) => setAdj({ levels: { ...levels, outWhite: v } })}
          />
        </PanelSection>
      ) : null}

      {/* 曲线 */}
      <ToggleChip
        label={t('tools.photo.adjCurves')}
        active={Boolean(curves)}
        onClick={() => setAdj({ curves: curves ? null : defaultCurves() })}
      />
      {curves ? (
        <PanelSection>
          <CurveEditor
            points={curvePointsFrom(curves.rgb)}
            label={t('tools.photo.adjCurves')}
            onChange={(points: CurvePoint[]) => setAdj({ curves: { ...curves, rgb: points } })}
            onCommit={() => commit('histAdjust')}
          />
        </PanelSection>
      ) : null}

      {/* 色彩平衡 */}
      <ToggleChip
        label={t('tools.photo.adjColorBalance')}
        active={Boolean(balance)}
        onClick={() => setAdj({ colorBalance: balance ? null : defaultColorBalance() })}
      />
      {balance ? (
        <PanelSection>
          {CB_TONES.map((tone, toneIndex) => (
            <div key={tone} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t(`tools.photo.${CB_TONE_LABELS[toneIndex]}`)}
              </span>
              {balance[tone].map((axisValue, axisIndex) => (
                <Slider
                  key={CB_AXIS_LABELS[axisIndex]}
                  label={t(`tools.photo.${CB_AXIS_LABELS[axisIndex]}`)}
                  value={axisValue}
                  min={-100}
                  max={100}
                  onChange={(next) => patchBalance(tone, axisIndex, next)}
                />
              ))}
            </div>
          ))}
        </PanelSection>
      ) : null}

      {/* 黑白 */}
      <ToggleChip
        label={t('tools.photo.adjBlackWhite')}
        active={Boolean(bw)}
        onClick={() => setAdj({ blackWhite: bw ? null : defaultBlackWhite() })}
      />
      {bw ? (
        <PanelSection>
          {BW_CHANNELS.map((channel) => (
            <Slider
              key={channel.key}
              label={t(`tools.photo.${channel.label}`)}
              value={bw[channel.key]}
              min={-100}
              max={300}
              onChange={(v) => setAdj({ blackWhite: { ...bw, [channel.key]: v } })}
            />
          ))}
        </PanelSection>
      ) : null}

      {/* 阈值 */}
      <ToggleChip
        label={t('tools.photo.adjThreshold')}
        active={threshold !== null && threshold !== undefined}
        onClick={() =>
          setAdj({ threshold: threshold === null || threshold === undefined ? 128 : null })
        }
      />
      {threshold !== null && threshold !== undefined ? (
        <PanelSection>
          <Slider
            label={t('tools.photo.adjThreshold')}
            value={threshold}
            min={0}
            max={255}
            onChange={(v) => setAdj({ threshold: v })}
          />
        </PanelSection>
      ) : null}

      {/* 渐变映射 */}
      <ToggleChip
        label={t('tools.photo.adjGradientMap')}
        active={Boolean(gradient)}
        onClick={() => setAdj({ gradientMap: gradient ? null : DEFAULT_GRADIENT })}
      />
      {gradient ? (
        <PanelSection>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('tools.photo.gmStart')}>
              <input
                type="color"
                aria-label={t('tools.photo.gmStart')}
                value={gradient.stops[0]?.color ?? '#000000'}
                onChange={(event) =>
                  setAdj({
                    gradientMap: {
                      stops: [
                        { pos: 0, color: event.target.value.toUpperCase() },
                        gradient.stops[1] ?? { pos: 1, color: '#FFFFFF' },
                      ],
                    },
                  })
                }
                className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
              />
            </Field>
            <Field label={t('tools.photo.gmEnd')}>
              <input
                type="color"
                aria-label={t('tools.photo.gmEnd')}
                value={gradient.stops[1]?.color ?? '#FFFFFF'}
                onChange={(event) =>
                  setAdj({
                    gradientMap: {
                      stops: [
                        gradient.stops[0] ?? { pos: 0, color: '#000000' },
                        { pos: 1, color: event.target.value.toUpperCase() },
                      ],
                    },
                  })
                }
                className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
              />
            </Field>
          </div>
        </PanelSection>
      ) : null}

      {/* 去色 */}
      <ToggleChip
        label={t('tools.photo.adjDesaturate')}
        active={Boolean(value.desaturate)}
        onClick={() => setAdj({ desaturate: value.desaturate ? undefined : true })}
      />

      {/* 更多调整：照片滤镜 / 通道混合器 / 阴影高光 / 可选颜色 / 替换颜色 */}
      <MoreAdjustments value={value} setAdj={setAdj} />

      <PanelSection>
        <Button
          onClick={() => patchActive({ adjustments: createAdjustments() } as never)}
          title={t('tools.photo.resetAdjust')}
        >
          {t('tools.photo.resetAdjust')}
        </Button>
      </PanelSection>
    </div>
  );
}
