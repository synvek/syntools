import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_COLOR,
  DEFAULT_OPACITY,
  DEFAULT_SECONDARY,
  DEFAULT_WIDTH,
  clampBrushSize,
  clampUnit,
  type ToolId,
} from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { useBoardStore } from './store';
import BoardCanvas from './ui/BoardCanvas';
import BoardToolbar from './ui/BoardToolbar';

/** 数字键 1~9 对应的工具顺序（与工具栏一致） */
const TOOL_ORDER: ToolId[] = [
  'pen',
  'marker',
  'eraser',
  'line',
  'arrow',
  'rect',
  'ellipse',
  'polygon',
  'text',
];

/** 字母快捷键：吸管 / 移动（对齐常见图像编辑器的 I / V） */
const LETTER_TOOLS: Record<string, ToolId> = { i: 'picker', v: 'move' };

/** 在线涂鸦画板 */
export default function DoodleBoardTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        c: DEFAULT_COLOR,
        s: DEFAULT_WIDTH,
        o: DEFAULT_OPACITY,
        b: 'solid',
        sc: DEFAULT_SECONDARY,
      }),
    [],
  );
  const [restored, setRestored] = useState(false);
  const tool = useBoardStore((s) => s.tool);
  const brush = useBoardStore((s) => s.brush);
  const secondary = useBoardStore((s) => s.secondary);
  const background = useBoardStore((s) => s.scene.background.kind);

  // 多边形 / 移动 / 吸管这类「操作方式特殊」的工具给出针对性提示
  const contextualHint =
    tool === 'polygon'
      ? t('tools.doodle.polygonHint')
      : tool === 'move'
        ? t('tools.doodle.moveHint')
        : tool === 'picker'
          ? t('tools.doodle.pickerHint')
          : null;

  // 本地草稿：进入时先恢复（分享链接的参数随后覆盖，保证链接所见即所得）
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.ops.length > 0) {
      const state = useBoardStore.getState();
      state.replaceScene(draft);
      // 草稿自带尺寸：切到自定义，避免自适应的首帧把尺寸改掉
      state.setPreset('custom');
      setRestored(true);
      window.setTimeout(() => setRestored(false), 2400);
    }
    let timer: number | undefined;
    const unsubscribe = useBoardStore.subscribe((next, prev) => {
      if (next.scene === prev.scene) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (next.scene.ops.length > 0) writeDraft(next.scene);
        else clearDraft();
      }, 600);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // 分享链接里的画笔 / 背景参数：在草稿恢复之后应用，链接参数优先
  useEffect(() => {
    const state = useBoardStore.getState();
    state.setPrimaryColor(init.c);
    state.patchBrush({
      width: clampBrushSize(init.s),
      opacity: clampUnit(init.o),
    });
    state.setSecondaryColor(init.sc);
    if (init.b !== 'solid') {
      state.setBackground({ kind: init.b === 'grid' ? 'grid' : 'transparent' });
    }
  }, [init]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (meta && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBoardStore.getState().redo();
        else useBoardStore.getState().undo();
        return;
      }
      if (meta && key === 'y') {
        e.preventDefault();
        useBoardStore.getState().redo();
        return;
      }
      if (meta || e.altKey) return;
      const index = Number(e.key);
      if (Number.isInteger(index) && index >= 1 && index <= TOOL_ORDER.length) {
        e.preventDefault();
        useBoardStore.getState().setTool(TOOL_ORDER[index - 1]);
        return;
      }
      const letter = LETTER_TOOLS[key];
      if (letter) {
        e.preventDefault();
        useBoardStore.getState().setTool(letter);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <BoardToolbar />
      <BoardCanvas />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {contextualHint ?? `${t('tools.doodle.hint')} · ${t('tools.doodle.hintKeys')}`}
        </p>
        <div className="flex items-center gap-2">
          {restored ? (
            <span className="animate-pulse rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
              {t('tools.doodle.draftRestored')}
            </span>
          ) : null}
          <ShareButton
            getState={() => ({
              c: brush.color,
              s: brush.width,
              o: Math.round(brush.opacity * 100) / 100,
              b: background,
              sc: secondary,
            })}
          />
        </div>
      </div>
    </div>
  );
}
