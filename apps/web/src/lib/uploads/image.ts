/**
 * Server-side validation for uploaded photos. The declared MIME type is not
 * trusted: the format is detected from the file signature, and JPEG
 * metadata segments (EXIF, XMP, comments — which can carry GPS position and
 * device identifiers) are removed without re-encoding the image.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp';

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export function detectImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Removes APPn (except APP0/JFIF and APP14/Adobe colour info) and COM
 * segments from a JPEG. Returns the input unchanged if it cannot be parsed.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return bytes;
    const marker = bytes[i + 1];
    // Start of scan: the rest is entropy-coded image data.
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
      return Uint8Array.from(out);
    }
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return bytes;
    const isStrippedApp = marker >= 0xe1 && marker <= 0xef && marker !== 0xee;
    const isComment = marker === 0xfe;
    if (!isStrippedApp && !isComment) {
      for (let j = i; j < i + 2 + length; j++) out.push(bytes[j]);
    }
    i += 2 + length;
  }
  return bytes;
}

/** Reads pixel dimensions from PNG IHDR or JPEG SOFn when present. */
export function readImageSize(bytes: Uint8Array, kind: ImageKind): { width: number; height: number } | null {
  if (kind === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (kind === 'image/jpeg') {
    let i = 2;
    while (i + 9 < bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1];
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + length;
    }
  }
  return null;
}
