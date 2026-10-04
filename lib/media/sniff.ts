// Magic byte detection for image types (no external magic library)

const MAGIC_BYTES: Record<string, { mime: string; bytes: number[] }> = {
  jpeg: { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  webp: { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
  heic: { mime: "image/heic", bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] }, // ftyp
};

export async function sniffMimeType(buffer: Buffer): Promise<string | null> {
  // Check JPEG
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // Check PNG
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }

  // Check WebP (RIFF...WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // Check HEIC (ftyp header)
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "image/heic";
  }

  return null;
}

export function isAcceptedMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(mime.toLowerCase());
}
