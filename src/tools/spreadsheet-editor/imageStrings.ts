/**
 * 图片功能的文案（SHEET-02 剩余）。
 *
 * 单独一份而不是塞进 shapeStrings：那份是按固定键数组逐个语言对齐的，图片只是一小簇新键，
 * 独立注册不会打乱既有顺序，也方便以后整体搬到统一的 strings 里。
 */

type ResourceTree = { tools: { sheet: Record<string, string> } };
type Registrar = {
  addResourceBundle: (
    lng: string,
    ns: string,
    resources: ResourceTree,
    deep: boolean,
    overwrite: boolean,
  ) => void;
};

const zh: ResourceTree = {
  tools: {
    sheet: {
      insertImage: '插入图片',
      imageTooLarge: '图片超过 8 MB，请压缩后再插入',
      imageReadFailed: '无法读取该图片（支持 PNG / JPEG / GIF / WebP）',
      imageBringFront: '置于顶层',
      imageSendBack: '置于底层',
      imageRemove: '删除图片',
    },
  },
};

const en: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Insert picture',
      imageTooLarge: 'The picture is larger than 8 MB — compress it first',
      imageReadFailed: 'Cannot read this picture (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'Bring to front',
      imageSendBack: 'Send to back',
      imageRemove: 'Remove picture',
    },
  },
};

const zhTW: ResourceTree = {
  tools: {
    sheet: {
      insertImage: '插入圖片',
      imageTooLarge: '圖片超過 8 MB，請壓縮後再插入',
      imageReadFailed: '無法讀取此圖片（支援 PNG / JPEG / GIF / WebP）',
      imageBringFront: '置於頂層',
      imageSendBack: '置於底層',
      imageRemove: '刪除圖片',
    },
  },
};

const ja: ResourceTree = {
  tools: {
    sheet: {
      insertImage: '画像を挿入',
      imageTooLarge: '画像が 8 MB を超えています。圧縮してから挿入してください',
      imageReadFailed: 'この画像を読み込めません（PNG / JPEG / GIF / WebP）',
      imageBringFront: '最前面へ移動',
      imageSendBack: '最背面へ移動',
      imageRemove: '画像を削除',
    },
  },
};

const fr: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Insérer une image',
      imageTooLarge: 'L’image dépasse 8 Mo — compressez-la d’abord',
      imageReadFailed: 'Impossible de lire cette image (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'Mettre au premier plan',
      imageSendBack: 'Mettre à l’arrière-plan',
      imageRemove: 'Supprimer l’image',
    },
  },
};

const de: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Bild einfügen',
      imageTooLarge: 'Das Bild ist größer als 8 MB — bitte zuerst komprimieren',
      imageReadFailed: 'Dieses Bild kann nicht gelesen werden (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'In den Vordergrund',
      imageSendBack: 'In den Hintergrund',
      imageRemove: 'Bild entfernen',
    },
  },
};

const it: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Inserisci immagine',
      imageTooLarge: 'L’immagine supera 8 MB — comprimila prima',
      imageReadFailed: 'Impossibile leggere questa immagine (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'Porta in primo piano',
      imageSendBack: 'Porta in secondo piano',
      imageRemove: 'Rimuovi immagine',
    },
  },
};

const es: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Insertar imagen',
      imageTooLarge: 'La imagen supera los 8 MB: comprímela primero',
      imageReadFailed: 'No se puede leer esta imagen (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'Traer al frente',
      imageSendBack: 'Enviar al fondo',
      imageRemove: 'Quitar imagen',
    },
  },
};

const pt: ResourceTree = {
  tools: {
    sheet: {
      insertImage: 'Inserir imagem',
      imageTooLarge: 'A imagem excede 8 MB — comprima-a primeiro',
      imageReadFailed: 'Não é possível ler esta imagem (PNG / JPEG / GIF / WebP)',
      imageBringFront: 'Trazer para a frente',
      imageSendBack: 'Enviar para trás',
      imageRemove: 'Remover imagem',
    },
  },
};

export const imageStrings: Record<string, ResourceTree> = {
  zh,
  en,
  'zh-TW': zhTW,
  ja,
  fr,
  de,
  it,
  es,
  pt,
};

export function registerImageStrings(instance: Registrar): void {
  for (const [lng, resources] of Object.entries(imageStrings)) {
    instance.addResourceBundle(lng, 'translation', resources, true, true);
  }
}
