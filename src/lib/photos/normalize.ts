import sharp from 'sharp';

export const MAX_PHOTO_INPUT = 4_000_000;
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_PHOTO_INPUT) throw new Error('The photo is too large. Choose a photo under 4 MB.');
  try {
    const image = sharp(input, {limitInputPixels: 40_000_000, animated: false});
    const info = await image.metadata();
    if (!info.format || !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(info.format)) throw new Error('Unsupported image');
    // Re-encode rather than trusting the file name/MIME. This also strips EXIF,
    // including camera location, and bounds both dimensions and storage size.
    const result = await image.rotate().resize(960, 960, {fit: 'inside', withoutEnlargement: true}).webp({quality: 78}).toBuffer();
    if (result.length > 256_000) return sharp(result).resize(720,720,{fit:'inside'}).webp({quality:60}).toBuffer().then(bytes => {
      if (bytes.length > 256_000) throw new Error('Photo is too complex');
      return bytes;
    });
    return result;
  } catch {
    throw new Error('Could not read this photo. Choose a JPEG, PNG, WebP or AVIF image.');
  }
}
