import { LocaleType, mergeLocales, Univer, type IWorkbookData } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import DesignEnUS from '@univerjs/design/locale/en-US';
import DesignZhCN from '@univerjs/design/locale/zh-CN';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import DocsUIZhCN from '@univerjs/docs-ui/locale/zh-CN';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import '@univerjs/engine-formula/facade';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsZhCN from '@univerjs/sheets/locale/zh-CN';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
import SheetsFormulaUIZhCN from '@univerjs/sheets-formula-ui/locale/zh-CN';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';
import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';
import SheetsNumfmtUIZhCN from '@univerjs/sheets-numfmt-ui/locale/zh-CN';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsUIZhCN from '@univerjs/sheets-ui/locale/zh-CN';
import { UniverUIPlugin } from '@univerjs/ui';
import UIEnUS from '@univerjs/ui/locale/en-US';
import UIZhCN from '@univerjs/ui/locale/zh-CN';
// 副作用导入：给 FUniver 追加 createWorkbook / getActiveWorkbook 等工作簿方法
import '@univerjs/sheets/facade';
import '@univerjs/sheets-ui/facade';
// 样式必须按 design → ui → docs-ui → sheets-ui → formula-ui → numfmt-ui 的顺序引入
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * Univer 适配层：插件注册、语言包、主题与生命周期收敛在单一出口。
 * 本模块只会被懒加载的 SpreadsheetTool 引用，因此 Univer 不会进入首屏包。
 */

export interface UniverHandle {
  loadSnapshot(snapshot: WorkbookSnapshot): void;
  getSnapshot(): WorkbookSnapshot;
  dispose(): void;
}

const ZH_LOCALE = mergeLocales(
  DesignZhCN,
  UIZhCN,
  DocsUIZhCN,
  SheetsZhCN,
  SheetsUIZhCN,
  SheetsFormulaUIZhCN,
  SheetsNumfmtUIZhCN,
);
const EN_LOCALE = mergeLocales(
  DesignEnUS,
  UIEnUS,
  DocsUIEnUS,
  SheetsEnUS,
  SheetsUIEnUS,
  SheetsFormulaUIEnUS,
  SheetsNumfmtUIEnUS,
);

/**
 * 创建 Univer 实例并挂载到 container。
 * 语言/主题变化需要重建实例，调用方应先取快照再重建（见 SpreadsheetTool 的 pendingRef）。
 */
export function createUniverInstance(
  container: HTMLElement,
  options: { locale: 'zhCN' | 'enUS'; dark: boolean },
): UniverHandle {
  const locale = options.locale === 'enUS' ? LocaleType.EN_US : LocaleType.ZH_CN;
  const univer = new Univer({
    locale,
    locales: { [LocaleType.ZH_CN]: ZH_LOCALE, [LocaleType.EN_US]: EN_LOCALE },
    darkMode: options.dark,
  });

  univer.registerPlugin(UniverRenderEnginePlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin);
  univer.registerPlugin(UniverUIPlugin, { container, header: true, toolbar: true, footer: false });
  univer.registerPlugin(UniverDocsPlugin);
  univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverSheetsUIPlugin);
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  univer.registerPlugin(UniverSheetsFormulaUIPlugin);
  univer.registerPlugin(UniverSheetsNumfmtPlugin);
  univer.registerPlugin(UniverSheetsNumfmtUIPlugin);

  const univerAPI = FUniver.newAPI(univer);
  // 必须存在工作簿实例，否则 Univer 只渲染外壳而不出网格画布
  univerAPI.createWorkbook(createEmptySnapshot() as unknown as Partial<IWorkbookData>);

  const loadSnapshot = (snapshot: WorkbookSnapshot): void => {
    const current = univerAPI.getActiveWorkbook();
    if (current) univerAPI.disposeUnit(current.getId());
    univerAPI.createWorkbook(snapshot as unknown as Partial<IWorkbookData>);
  };

  const getSnapshot = (): WorkbookSnapshot => {
    const workbook = univerAPI.getActiveWorkbook();
    return (workbook?.save() ?? {}) as unknown as WorkbookSnapshot;
  };

  const dispose = (): void => {
    univer.dispose();
    container.replaceChildren();
  };

  return { loadSnapshot, getSnapshot, dispose };
}
