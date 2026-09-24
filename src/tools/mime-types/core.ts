export interface MimeEntry {
  ext: string;
  mime: string;
  description: string;
}

export const MIME_TYPES: MimeEntry[] = [
  { ext: '.html', mime: 'text/html', description: 'HTML document' },
  { ext: '.htm', mime: 'text/html', description: 'HTML document' },
  { ext: '.css', mime: 'text/css', description: 'Cascading Style Sheets' },
  { ext: '.js', mime: 'text/javascript', description: 'JavaScript source' },
  { ext: '.mjs', mime: 'text/javascript', description: 'JavaScript module' },
  { ext: '.json', mime: 'application/json', description: 'JSON data' },
  { ext: '.txt', mime: 'text/plain', description: 'Plain text' },
  { ext: '.csv', mime: 'text/csv', description: 'Comma-separated values' },
  { ext: '.xml', mime: 'application/xml', description: 'XML document' },
  { ext: '.yaml', mime: 'application/yaml', description: 'YAML document' },
  { ext: '.md', mime: 'text/markdown', description: 'Markdown document' },
  { ext: '.pdf', mime: 'application/pdf', description: 'PDF document' },
  { ext: '.png', mime: 'image/png', description: 'PNG image' },
  { ext: '.jpg', mime: 'image/jpeg', description: 'JPEG image' },
  { ext: '.jpeg', mime: 'image/jpeg', description: 'JPEG image' },
  { ext: '.gif', mime: 'image/gif', description: 'GIF image' },
  { ext: '.webp', mime: 'image/webp', description: 'WebP image' },
  { ext: '.avif', mime: 'image/avif', description: 'AVIF image' },
  { ext: '.svg', mime: 'image/svg+xml', description: 'SVG vector image' },
  { ext: '.ico', mime: 'image/x-icon', description: 'Icon file' },
  { ext: '.bmp', mime: 'image/bmp', description: 'Bitmap image' },
  { ext: '.tiff', mime: 'image/tiff', description: 'TIFF image' },
  { ext: '.mp3', mime: 'audio/mpeg', description: 'MP3 audio' },
  { ext: '.wav', mime: 'audio/wav', description: 'WAVE audio' },
  { ext: '.ogg', mime: 'audio/ogg', description: 'Ogg audio' },
  { ext: '.flac', mime: 'audio/flac', description: 'FLAC audio' },
  { ext: '.aac', mime: 'audio/aac', description: 'AAC audio' },
  { ext: '.mp4', mime: 'video/mp4', description: 'MP4 video' },
  { ext: '.webm', mime: 'video/webm', description: 'WebM video' },
  { ext: '.mov', mime: 'video/quicktime', description: 'QuickTime video' },
  { ext: '.avi', mime: 'video/x-msvideo', description: 'AVI video' },
  { ext: '.mkv', mime: 'video/x-matroska', description: 'Matroska video' },
  { ext: '.zip', mime: 'application/zip', description: 'ZIP archive' },
  { ext: '.gz', mime: 'application/gzip', description: 'Gzip archive' },
  { ext: '.tar', mime: 'application/x-tar', description: 'TAR archive' },
  { ext: '.7z', mime: 'application/x-7z-compressed', description: '7-Zip archive' },
  { ext: '.rar', mime: 'application/vnd.rar', description: 'RAR archive' },
  { ext: '.woff', mime: 'font/woff', description: 'Web Open Font Format' },
  { ext: '.woff2', mime: 'font/woff2', description: 'Web Open Font Format 2' },
  { ext: '.ttf', mime: 'font/ttf', description: 'TrueType font' },
  { ext: '.otf', mime: 'font/otf', description: 'OpenType font' },
  { ext: '.wasm', mime: 'application/wasm', description: 'WebAssembly module' },
  { ext: '.doc', mime: 'application/msword', description: 'Word document' },
  {
    ext: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Word document (OOXML)',
  },
  { ext: '.xls', mime: 'application/vnd.ms-excel', description: 'Excel spreadsheet' },
  {
    ext: '.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Excel spreadsheet (OOXML)',
  },
  { ext: '.ppt', mime: 'application/vnd.ms-powerpoint', description: 'PowerPoint presentation' },
  {
    ext: '.pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    description: 'PowerPoint presentation (OOXML)',
  },
  { ext: '.ics', mime: 'text/calendar', description: 'iCalendar data' },
  { ext: '.vcf', mime: 'text/vcard', description: 'vCard contact' },
];

/** 按扩展名、MIME 或描述过滤。 */
export function filterMimes(query: string): MimeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return MIME_TYPES;
  const withDot = q.startsWith('.') ? q : `.${q}`;
  return MIME_TYPES.filter(
    (m) =>
      m.ext.toLowerCase() === withDot ||
      m.ext.toLowerCase().includes(withDot) ||
      m.mime.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q),
  );
}

/** 按扩展名（可带不带点）精确查询 MIME。 */
export function mimeForExtension(ext: string): string | null {
  const q = ext.trim().toLowerCase();
  const withDot = q.startsWith('.') ? q : `.${q}`;
  return MIME_TYPES.find((m) => m.ext === withDot)?.mime ?? null;
}
