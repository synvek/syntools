import { IRenderManagerService, SHEET_VIEWPORT_KEY } from '@univerjs/engine-render';
import type { SheetViewport } from './shapes';

/**
 * Univer 内部 API 的唯一入口（P2-11）。
 *
 * 形状 / 图片 / 图表浮层要跟着表格滚动与缩放，就必须知道"单元格在容器里的位置"，而门面
 * （`FUniver`）没有这个能力。唯一的做法是走内部注入器：
 *
 * ```ts
 * univer.__getInjector().get(IRenderManagerService).getRenderById(unitId)
 *   → render.scene.{scaleX, getViewport, getViewportScrollXY}
 *   → render.engine.getCanvasElement()
 * ```
 *
 * 这串东西在升级时是**最容易断**的地方：`__getInjector` 是双下划线 API，`scene` / `engine`
 * 的成员也没有契约。所以这里定了三条规矩：
 *
 * 1. **只在这个文件里出现内部符号**——升级出问题时只需要读一个文件；
 * 2. **每一步都探测，失败给具体码**——不是布尔，而是 `missingInjector` / `injectorThrew` /
 *    `missingRender` / `missingViewport` / `readThrew`，可以直接写进升级检查清单；
 * 3. **失败只降级，不抛**——浮层停止跟随（退回上一次的位置），工具栏、编辑、保存全部照常。
 *
 * `univer-internals.test.ts` 是契约测试：它用假对象模拟"每一层都可能缺/可能抛"，
 * 保证升级后这几个分支仍然只有这几种结果。
 */

/** 内部读取失败的分类。升到新版本时，先看这里报的是哪一种 */
export type InternalsFailureCode =
  'missingInjector' | 'injectorThrew' | 'missingRender' | 'missingViewport' | 'readThrew';

export type InternalsResult<T> =
  { ok: true; value: T } | { ok: false; code: InternalsFailureCode; detail?: string };

/** 结构性描述：只声明我们真的用到的那几个成员，升级时按这份对齐即可 */
interface InjectorLike {
  get(token: unknown): unknown;
}

/** `Univer` 实例的最小可调用面：只要求"可能有 `__getInjector`" */
export interface InternalsHost {
  __getInjector?: () => InjectorLike;
}

interface SceneLike {
  scaleX: number;
  getViewport(key: string): { left?: number; top?: number } | null | undefined;
  getViewportScrollXY(viewport: unknown): { x: number; y: number };
}

interface EngineLike {
  getCanvasElement(): HTMLCanvasElement;
}

interface RenderLike {
  scene: SceneLike;
  engine: EngineLike;
}

function failure(code: InternalsFailureCode, detail?: string): InternalsResult<never> {
  return { ok: false, code, ...(detail === undefined ? {} : { detail }) };
}

/**
 * 探测内部注入器是否还在。
 * 便宜（不读布局），可以放心在每次实例创建后调一次，用于"这个版本还能不能跟随滚动"的诊断。
 */
export function probeUniverInternals(
  host: InternalsHost,
): InternalsResult<{ render: (unitId: string) => RenderLike | null }> {
  let injector: InjectorLike | undefined;
  try {
    injector = host.__getInjector?.();
  } catch (error) {
    return failure('injectorThrew', String(error));
  }
  if (!injector) return failure('missingInjector');
  return {
    ok: true,
    value: {
      render: (unitId: string): RenderLike | null => {
        try {
          const service = injector?.get?.(IRenderManagerService) as
            { getRenderById?: (id: string) => RenderLike | null | undefined } | undefined;
          return service?.getRenderById?.(unitId) ?? null;
        } catch {
          return null;
        }
      },
    },
  };
}

/**
 * 读表格视口投影：容器内 CSS px 的原点、滚动量、缩放与可视尺寸。
 *
 * 三段偏移必须相加，缺一个浮层就会错位：
 * 1. canvas 在容器内的位置（Ribbon 与公式栏在它上面）；
 * 2. `viewMain` 自身的 left/top（Univer 用它们表示行头宽 / 列头高）；
 * 3. 视口滚动（内容 px，需乘缩放）与缩放本身。
 */
export function readSheetViewport(
  host: InternalsHost,
  unitId: string,
  container: HTMLElement,
): InternalsResult<SheetViewport> {
  const probe = probeUniverInternals(host);
  if (!probe.ok) return probe;

  const render = probe.value.render(unitId);
  if (!render) return failure('missingRender');

  try {
    const viewMain = render.scene.getViewport(SHEET_VIEWPORT_KEY.VIEW_MAIN);
    if (!viewMain) return failure('missingViewport');

    const zoom = Math.abs(render.scene.scaleX) || 1;
    const scroll = render.scene.getViewportScrollXY(viewMain);
    const containerBox = container.getBoundingClientRect();
    const canvasBox = render.engine.getCanvasElement().getBoundingClientRect();
    const headerX = (viewMain.left ?? 0) * zoom;
    const headerY = (viewMain.top ?? 0) * zoom;
    return {
      ok: true,
      value: {
        originX: canvasBox.left - containerBox.left + headerX,
        originY: canvasBox.top - containerBox.top + headerY,
        scrollX: scroll.x,
        scrollY: scroll.y,
        zoom,
        // canvas 也盖住行头 / 列头，只有剩下的部分显示单元格
        width: Math.max(0, canvasBox.width - headerX),
        height: Math.max(0, canvasBox.height - headerY),
      },
    };
  } catch (error) {
    // 场景 / 引擎成员被重命名或换了签名：同样只降级
    return failure('readThrew', String(error));
  }
}
