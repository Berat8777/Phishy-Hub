import sharp from 'sharp';

const THUMBNAIL_SIZE = 256;

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Synchronous (within the request) 256x256 webp thumbnail — architecture doc §5 step 1. */
export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}
