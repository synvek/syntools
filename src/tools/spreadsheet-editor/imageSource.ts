/** 图片进入快照前的两步读取：都只碰浏览器 API，单独成模块以便在 hook 里被替换 / 打桩 */

/** File → dataURL：图片要存进快照，必须自包含（不能引用原文件路径） */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** dataURL → 原始像素尺寸；量不出来（损坏 / 环境不支持）时返回 0，交给 fitImageSize 兜底 */
export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve({ width: 0, height: 0 });
    probe.src = src;
  });
}
