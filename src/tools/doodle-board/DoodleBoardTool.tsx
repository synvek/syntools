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

/** Tool order for number keys 1-9 (matches the toolbar) */
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

/** Letter shortcuts: eyedropper / move (matching the I / V of common image editors) */
const LETTER_TOOLS: Record<string, ToolId> = { i: 'picker', v: 'move' };

/** Online doodle board */
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

  // Tools with unusual interactions (polygon / move / eyedropper) get a tailored hint
  const contextualHint =
    tool === 'polygon'
      ? t('tools.doodle.polygonHint')
      : tool === 'move'
        ? t('tools.doodle.moveHint')
        : tool === 'picker'
          ? t('tools.doodle.pickerHint')
          : null;

  // Local draft: restore on entry (share-link parameters are applied afterwards and take precedence)
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.ops.length > 0) {
      const state = useBoardStore.getState();
      state.replaceScene(draft);
      // The draft carries its own size: switch to custom so the first fit pass cannot resize it
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

  // Brush / background parameters from the share link: applied after the draft, so the link wins
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
