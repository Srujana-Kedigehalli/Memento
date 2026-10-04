import sharp from "sharp";

export async function processImage(inputBuffer: Buffer, _declaredMime: string): Promise<{
  displayJpeg: Buffer;
  thumbnailJpeg: Buffer;
  width: number;
  height: number;
}> {
  let sharpImage = sharp(inputBuffer);

  // Note: HEIC/HEIF support may require additional setup; for now, assume
  // inputBuffer is already a supported format or has been pre-converted
  // (This is handled by upload processing middleware in production)

  // Get metadata
  const metadata = await sharpImage.metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;

  // Rotate based on EXIF (metadata is stripped during JPEG encoding)
  const rotated = sharpImage.rotate();

  // Full-size display JPEG (max 2560px, quality 85)
  const displayJpeg = await rotated
    .clone()
    .resize(2560, 2560, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();

  // Thumbnail (max 480px, quality 80)
  const thumbnailJpeg = await rotated
    .clone()
    .resize(480, 480, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();

  return { displayJpeg, thumbnailJpeg, width, height };
}
