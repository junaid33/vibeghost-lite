import type { FileUIPart } from 'ai';

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_MAX_COUNT = 4;
export const CHAT_GENERATED_IMAGE_MAX_BYTES = 32 * 1024 * 1024;

export class ChatImageError extends Error {
  readonly name = 'ChatImageError';
  constructor(public readonly code: 'image-prompt' | 'image-response' | 'image-storage') { super(code); }
}
export const CHAT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export function parseChatImageUrl(value: string) {
  const match = /^\/api\/completion\/([\w-]{1,128})\/images\/([\w-]{1,128})$/.exec(value);
  return match ? { threadId: match[1], imageId: match[2] } : null;
}

/** Only raster images; do not serve active SVG/HTML even if mislabeled. */
export function chatImageMediaType(data: Uint8Array): string | null {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte);
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
  if (starts(255, 216, 255)) return 'image/jpeg';
  const text = (start: number, end: number) => String.fromCharCode(...data.slice(start, end));
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (['GIF87a', 'GIF89a'].includes(text(0, 6))) return 'image/gif';
  return null;
}

export function isChatImagePart(value: unknown): value is FileUIPart {
  if (!value || typeof value !== 'object') return false;
  const part = value as Partial<FileUIPart>;
  return part.type === 'file' && typeof part.url === 'string' && Boolean(parseChatImageUrl(part.url)) && typeof part.mediaType === 'string' && CHAT_IMAGE_ACCEPT.split(',').includes(part.mediaType);
}
