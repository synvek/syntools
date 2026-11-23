/**
 * PDF editor UI copy, injected into i18next with the lazily loaded tool chunk.
 *
 * Same convention as rich-text-editor / slide-editor / spreadsheet-editor: a single tool's copy does not
 * go into the first-screen bundles (`core/i18n/locales/*`); `registerPdfEditorStrings` merges it into
 * i18next under `tools.pdfEditor.*` when the tool loads. Tool metadata (name/description) stays in
 * `toolsMeta` because the home card, sidebar and ⌘K search need it before the tool chunk arrives.
 *
 * Ribbon and file-level copy live in their own incremental blocks and are merged here so that a
 * milestone only edits the block it actually touches.
 */

import { annotateStrings } from './annotateStrings';
import { decorationStrings } from './decorationStrings';
import { editStrings } from './editStrings';
import { exportStrings } from './exportStrings';
import { fileStrings } from './fileStrings';
import { pageStrings } from './pageStrings';
import { panelStrings } from './panelStrings';
import { ribbonStrings } from './ribbonStrings';
import { viewStrings } from './viewStrings';

type StringTree = { [key: string]: string | StringTree };
type ResourceTree = { tools: { pdfEditor: StringTree } };

/** Base copy: empty state, status bar, error codes */
const base: Record<string, StringTree> = {
  zh: {
    privacy: '文件仅在本机处理，不会上传。',
    emptyTitle: '打开一份 PDF 开始编辑',
    emptyHint: '拖入或点击选择 PDF 或工程文件（.pdfproj）',
    emptyFormats: '支持 .pdf 与 .pdfproj，单文件不超过 50MB',
    stubTitle: '编辑器骨架已就绪',
    stubBody: '打开、浏览与保存能力将在后续里程碑接入。',
    statusPage: '第 {{page}} / {{total}} 页',
    statusPageSize: '页面尺寸',
    statusFileSize: '文件大小',
    saveProgress: '保存中 {{done}}/{{total}} 页',
    err: {
      NOT_PDF: '请选择 PDF 文件',
      TOO_LARGE: '文件过大（建议小于 50MB）',
      NO_PAGES: '文档没有可用页面',
      NEED_PASSWORD: '该 PDF 已加密，请输入密码',
      WRONG_PASSWORD: '密码不正确，请重试',
      LOAD_FAILED: '无法读取该 PDF',
      PROCESS_FAILED: '处理失败，请重试',
      INVALID_RANGE: '页码范围无效',
    },
  },
  'zh-TW': {
    privacy: '檔案僅在本機處理，不會上傳。',
    emptyTitle: '開啟一份 PDF 開始編輯',
    emptyHint: '拖入或點擊選擇 PDF 或專案檔（.pdfproj）',
    emptyFormats: '支援 .pdf 與 .pdfproj，單檔不超過 50MB',
    stubTitle: '編輯器骨架已就緒',
    stubBody: '開啟、瀏覽與儲存功能將於後續里程碑接入。',
    statusPage: '第 {{page}} / {{total}} 頁',
    statusPageSize: '頁面尺寸',
    statusFileSize: '檔案大小',
    saveProgress: '儲存中 {{done}}/{{total}} 頁',
    err: {
      NOT_PDF: '請選擇 PDF 檔案',
      TOO_LARGE: '檔案過大（建議小於 50MB）',
      NO_PAGES: '文件沒有可用頁面',
      NEED_PASSWORD: '此 PDF 已加密，請輸入密碼',
      WRONG_PASSWORD: '密碼不正確，請重試',
      LOAD_FAILED: '無法讀取此 PDF',
      PROCESS_FAILED: '處理失敗，請重試',
      INVALID_RANGE: '頁碼範圍無效',
    },
  },
  en: {
    privacy: 'Files are processed on this device and never uploaded.',
    emptyTitle: 'Open a PDF to start editing',
    emptyHint: 'Drop a PDF or a project file here, or click to choose one',
    emptyFormats: 'PDF or .pdfproj, up to 50 MB per file',
    stubTitle: 'Editor skeleton is in place',
    stubBody: 'Opening, browsing and saving arrive in the upcoming milestones.',
    statusPage: 'Page {{page}} of {{total}}',
    statusPageSize: 'Page size',
    statusFileSize: 'File size',
    saveProgress: 'Saving page {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Please choose a PDF file',
      TOO_LARGE: 'File is too large (recommended under 50 MB)',
      NO_PAGES: 'The document has no pages',
      NEED_PASSWORD: 'This PDF is encrypted — enter its password',
      WRONG_PASSWORD: 'Incorrect password, please try again',
      LOAD_FAILED: 'This PDF could not be read',
      PROCESS_FAILED: 'Processing failed, please try again',
      INVALID_RANGE: 'Invalid page range',
    },
  },
  ja: {
    privacy: 'ファイルはこの端末内で処理され、アップロードされません。',
    emptyTitle: 'PDF を開いて編集を開始',
    emptyHint: 'PDF またはプロジェクトファイル（.pdfproj）をドロップするか、クリックして選択',
    emptyFormats: 'PDF と .pdfproj、1 ファイル 50MB まで',
    stubTitle: 'エディターの土台ができました',
    stubBody: '開く・閲覧・保存は今後のマイルストーンで追加されます。',
    statusPage: '{{page}} / {{total}} ページ',
    statusPageSize: 'ページサイズ',
    statusFileSize: 'ファイルサイズ',
    saveProgress: '保存中 {{done}}/{{total}} ページ',
    err: {
      NOT_PDF: 'PDF ファイルを選択してください',
      TOO_LARGE: 'ファイルが大きすぎます（50MB 未満を推奨）',
      NO_PAGES: 'ページがありません',
      NEED_PASSWORD: 'この PDF は暗号化されています。パスワードを入力してください',
      WRONG_PASSWORD: 'パスワードが正しくありません',
      LOAD_FAILED: 'PDF を読み込めませんでした',
      PROCESS_FAILED: '処理に失敗しました。もう一度お試しください',
      INVALID_RANGE: 'ページ範囲が無効です',
    },
  },
  fr: {
    privacy: 'Les fichiers sont traités sur cet appareil et ne sont jamais envoyés.',
    emptyTitle: 'Ouvrez un PDF pour commencer',
    emptyHint: 'Déposez un PDF ou un fichier de projet ici, ou cliquez pour le choisir',
    emptyFormats: 'PDF ou .pdfproj, 50 Mo maximum par fichier',
    stubTitle: 'La base de l’éditeur est en place',
    stubBody: 'L’ouverture, la navigation et l’enregistrement arrivent dans les prochaines étapes.',
    statusPage: 'Page {{page}} sur {{total}}',
    statusPageSize: 'Taille de page',
    statusFileSize: 'Taille du fichier',
    saveProgress: 'Enregistrement {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Veuillez choisir un fichier PDF',
      TOO_LARGE: 'Fichier trop volumineux (50 Mo recommandé au maximum)',
      NO_PAGES: 'Le document ne contient aucune page',
      NEED_PASSWORD: 'Ce PDF est chiffré — saisissez son mot de passe',
      WRONG_PASSWORD: 'Mot de passe incorrect, réessayez',
      LOAD_FAILED: 'Impossible de lire ce PDF',
      PROCESS_FAILED: 'Le traitement a échoué, réessayez',
      INVALID_RANGE: 'Plage de pages invalide',
    },
  },
  de: {
    privacy: 'Dateien werden auf diesem Gerät verarbeitet und nie hochgeladen.',
    emptyTitle: 'PDF öffnen und mit dem Bearbeiten beginnen',
    emptyHint: 'PDF oder Projektdatei hierher ziehen oder zum Auswählen klicken',
    emptyFormats: 'PDF oder .pdfproj, maximal 50 MB pro Datei',
    stubTitle: 'Das Editor-Gerüst steht',
    stubBody: 'Öffnen, Anzeigen und Speichern folgen in den nächsten Meilensteinen.',
    statusPage: 'Seite {{page}} von {{total}}',
    statusPageSize: 'Seitengröße',
    statusFileSize: 'Dateigröße',
    saveProgress: 'Speichern {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Bitte eine PDF-Datei auswählen',
      TOO_LARGE: 'Datei zu groß (empfohlen: unter 50 MB)',
      NO_PAGES: 'Das Dokument enthält keine Seiten',
      NEED_PASSWORD: 'Dieses PDF ist verschlüsselt — bitte Passwort eingeben',
      WRONG_PASSWORD: 'Falsches Passwort, bitte erneut versuchen',
      LOAD_FAILED: 'Dieses PDF konnte nicht gelesen werden',
      PROCESS_FAILED: 'Verarbeitung fehlgeschlagen, bitte erneut versuchen',
      INVALID_RANGE: 'Ungültiger Seitenbereich',
    },
  },
  it: {
    privacy: 'I file vengono elaborati su questo dispositivo e non vengono mai caricati.',
    emptyTitle: 'Apri un PDF per iniziare a modificarlo',
    emptyHint: 'Trascina qui un PDF o un file di progetto, oppure fai clic per sceglierlo',
    emptyFormats: 'PDF o .pdfproj, massimo 50 MB per file',
    stubTitle: 'La base dell’editor è pronta',
    stubBody: 'Apertura, navigazione e salvataggio arrivano nelle prossime tappe.',
    statusPage: 'Pagina {{page}} di {{total}}',
    statusPageSize: 'Dimensioni pagina',
    statusFileSize: 'Dimensione file',
    saveProgress: 'Salvataggio {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Scegli un file PDF',
      TOO_LARGE: 'File troppo grande (consigliato sotto 50 MB)',
      NO_PAGES: 'Il documento non contiene pagine',
      NEED_PASSWORD: 'Questo PDF è cifrato — inserisci la password',
      WRONG_PASSWORD: 'Password errata, riprova',
      LOAD_FAILED: 'Impossibile leggere questo PDF',
      PROCESS_FAILED: 'Elaborazione non riuscita, riprova',
      INVALID_RANGE: 'Intervallo di pagine non valido',
    },
  },
  es: {
    privacy: 'Los archivos se procesan en este dispositivo y nunca se suben.',
    emptyTitle: 'Abre un PDF para empezar a editarlo',
    emptyHint: 'Arrastra un PDF o un archivo de proyecto aquí, o haz clic para elegirlo',
    emptyFormats: 'PDF o .pdfproj, máximo 50 MB por archivo',
    stubTitle: 'La base del editor está lista',
    stubBody: 'Abrir, navegar y guardar llegan en las próximas etapas.',
    statusPage: 'Página {{page}} de {{total}}',
    statusPageSize: 'Tamaño de página',
    statusFileSize: 'Tamaño del archivo',
    saveProgress: 'Guardando {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Elige un archivo PDF',
      TOO_LARGE: 'Archivo demasiado grande (se recomienda menos de 50 MB)',
      NO_PAGES: 'El documento no tiene páginas',
      NEED_PASSWORD: 'Este PDF está cifrado: introduce su contraseña',
      WRONG_PASSWORD: 'Contraseña incorrecta, inténtalo de nuevo',
      LOAD_FAILED: 'No se pudo leer este PDF',
      PROCESS_FAILED: 'El procesamiento falló, inténtalo de nuevo',
      INVALID_RANGE: 'Intervalo de páginas no válido',
    },
  },
  pt: {
    privacy: 'Os arquivos são processados neste dispositivo e nunca são enviados.',
    emptyTitle: 'Abra um PDF para começar a editar',
    emptyHint: 'Arraste um PDF ou um arquivo de projeto para aqui, ou clique para escolher',
    emptyFormats: 'PDF ou .pdfproj, até 50 MB por arquivo',
    stubTitle: 'A base do editor está pronta',
    stubBody: 'Abrir, navegar e salvar chegam nas próximas etapas.',
    statusPage: 'Página {{page}} de {{total}}',
    statusPageSize: 'Tamanho da página',
    statusFileSize: 'Tamanho do arquivo',
    saveProgress: 'A guardar {{done}}/{{total}}',
    err: {
      NOT_PDF: 'Escolha um arquivo PDF',
      TOO_LARGE: 'Arquivo grande demais (recomendado abaixo de 50 MB)',
      NO_PAGES: 'O documento não tem páginas',
      NEED_PASSWORD: 'Este PDF está criptografado — informe a senha',
      WRONG_PASSWORD: 'Senha incorreta, tente novamente',
      LOAD_FAILED: 'Não foi possível ler este PDF',
      PROCESS_FAILED: 'O processamento falhou, tente novamente',
      INVALID_RANGE: 'Intervalo de páginas inválido',
    },
  },
};

/** Merge the ribbon + file blocks into one language tree */
function withExtras(lng: string): ResourceTree {
  return {
    tools: {
      pdfEditor: {
        ...base[lng],
        ...annotateStrings[lng],
        ...decorationStrings[lng],
        ...editStrings[lng],
        ...exportStrings[lng],
        ...pageStrings[lng],
        ...fileStrings[lng],
        ...panelStrings[lng],
        ...ribbonStrings[lng],
        ...viewStrings[lng],
      },
    },
  };
}

/** Language code → resource tree, keys aligned with `Lang` */
export const pdfEditorStrings: Record<string, ResourceTree> = {
  zh: withExtras('zh'),
  en: withExtras('en'),
  'zh-TW': withExtras('zh-TW'),
  ja: withExtras('ja'),
  fr: withExtras('fr'),
  de: withExtras('de'),
  it: withExtras('it'),
  es: withExtras('es'),
  pt: withExtras('pt'),
};

/** Merge this tool's copy into i18next (called on lazy load, key path tools.pdfEditor.*) */
export function registerPdfEditorStrings(instance: {
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: ResourceTree,
    deep: boolean,
    overwrite: boolean,
  ) => void;
}): void {
  for (const [lng, resources] of Object.entries(pdfEditorStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
